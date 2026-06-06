import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth'
import { sql } from '@/lib/db'
import { sendWithdrawalConfirmationEmail, sendWithdrawalDirectorNotification } from '@/lib/email'
import { DIRECTOR_CATEGORIES } from '@/lib/categories'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('bci_session')?.value
  const session = token ? await verifySession(token) : null

  if (!session || session.type !== 'member') {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // Fetch the submission — must belong to this member
  const rows = await sql`
    SELECT id, description, category, status, score, cluster_id, member_name, member_email
    FROM submissions
    WHERE id = ${id}
      AND (
        member_id = ${session.memberId}
        OR member_id = ${session.memberEmail}
        OR member_name = ${session.memberName}
      )
      AND deleted_at IS NULL
      AND withdrawn_at IS NULL
    LIMIT 1
  `

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
  }

  const sub = rows[0] as {
    id: number
    description: string
    category: string
    status: string
    score: number | null
    cluster_id: number | null
    member_name: string
    member_email: string | null
  }

  if (sub.status === 'implemented') {
    return NextResponse.json({ error: 'Implemented improvements cannot be withdrawn' }, { status: 409 })
  }

  // Mark as withdrawn
  await sql`
    UPDATE submissions
    SET withdrawn_at = NOW(), status = 'withdrawn',
        score = NULL, score_band = NULL, scored_at = NULL,
        triage_run_id = NULL, cluster_id = NULL
    WHERE id = ${id}
  `

  // Log to audit trail
  await sql`
    INSERT INTO status_log (submission_id, old_status, new_status, changed_by, note)
    VALUES (${id}, ${sub.status}, 'withdrawn', ${session.memberName ?? session.memberId}, 'Withdrawn by member')
  `

  // Decrement cluster size if was in a cluster
  if (sub.cluster_id) {
    await sql`
      UPDATE clusters SET size = GREATEST(0, size - 1), updated_at = NOW()
      WHERE id = ${sub.cluster_id}
    `
    // Clean up empty clusters
    await sql`DELETE FROM clusters WHERE id = ${sub.cluster_id} AND size = 0`
  }

  // Email the member (if they have an email and haven't opted out)
  if (sub.member_email) {
    try {
      await sendWithdrawalConfirmationEmail(sub.member_email, sub.description)
    } catch (e) {
      console.error('[withdraw] Failed to send member confirmation email:', e)
    }
  }

  // Notify relevant directors (those whose role covers this submission's category) — only if scored
  if (sub.score !== null) {
    try {
      const dirWithRoles = await sql`
        SELECT name, email, role FROM director_roles
        WHERE active = TRUE AND email_reports = TRUE
      `
      for (const dir of dirWithRoles as Array<{ name: string; email: string; role: string }>) {
        const cats = DIRECTOR_CATEGORIES[dir.role] ?? []
        if (cats.includes(sub.category)) {
          await sendWithdrawalDirectorNotification(dir.email, {
            memberName: sub.member_name ?? session.memberName ?? 'A member',
            description: sub.description,
            category: sub.category,
            score: sub.score,
          })
        }
      }
    } catch (e) {
      console.error('[withdraw] Failed to send director notification email:', e)
    }
  }

  return NextResponse.json({ ok: true })
}
