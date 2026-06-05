import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth'
import { sql } from '@/lib/db'
import { moderateSubmission } from '@/lib/ai'
import { CATEGORIES } from '@/lib/categories'
import { sendModerationRejectionEmail, sendSubmissionConfirmation } from '@/lib/email'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('bci_session')?.value
  const session = token ? await verifySession(token) : null

  if (!session || session.type !== 'member') {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { description, benefit, category, impact, recognition, emailOptOut } = await req.json()

  if (!description?.trim() || !benefit?.trim() || !category || !impact || !recognition) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }

  const cat = CATEGORIES.find((c) => c.value === category)
  if (!cat) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }

  const validImpacts = [2, 4, 6, 8]
  if (!validImpacts.includes(Number(impact))) {
    return NextResponse.json({ error: 'Invalid impact value' }, { status: 400 })
  }

  // Fetch member's existing submissions for duplicate check
  const existing = await sql`
    SELECT description FROM submissions
    WHERE member_id = ${session.memberId}
    ORDER BY created_at DESC
    LIMIT 10
  `
  const existingDescriptions = (existing as Array<{ description: string }>).map((r) => r.description)

  const moderation = await moderateSubmission(description.trim(), benefit.trim(), existingDescriptions)

  if (!moderation.pass) {
    // Log silent rejects to DB so Manager can review them
    if (moderation.silentReject) {
      await sql`
        INSERT INTO submissions (member_id, member_name, description, benefit, category, impact, recognition, status, moderation_reason)
        VALUES (
          ${session.memberId}, ${session.memberName},
          ${description.trim()}, ${benefit.trim()},
          ${category}, ${Number(impact)}, ${recognition},
          'rejected', ${moderation.reason ?? 'silent_reject'}
        )
      `
    }
    // Send rejection email to member if they have an email
    if (session.memberEmail && !emailOptOut) {
      void sendModerationRejectionEmail(session.memberEmail, {
        description: description.trim(),
        message: moderation.message,
      }).catch((e) => console.error('[submit] Moderation rejection email failed:', e))
    }
    return NextResponse.json({ ok: false, rejected: true, message: moderation.message })
  }

  await sql`
    INSERT INTO submissions (member_id, member_name, description, benefit, category, impact, recognition, member_email, email_opt_out)
    VALUES (
      ${session.memberId},
      ${session.memberName},
      ${description.trim()},
      ${benefit.trim()},
      ${category},
      ${Number(impact)},
      ${recognition},
      ${session.memberEmail ?? null},
      ${emailOptOut ? true : false}
    )
  `

  if (session.memberEmail && !emailOptOut) {
    void sendSubmissionConfirmation(session.memberEmail, description.trim())
      .catch((e) => console.error('[submit] Confirmation email failed:', e))
  }

  return NextResponse.json({
    ok: true,
    message: `Thank you — your improvement has been received. It will be assessed overnight and you'll receive an email update within 24 hours.`,
  })
}
