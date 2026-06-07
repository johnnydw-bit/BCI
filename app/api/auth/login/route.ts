import { NextRequest, NextResponse } from 'next/server'
import { loginMember, signSession } from '@/lib/auth'
import { sql } from '@/lib/db'
import { cookies } from 'next/headers'
import { getClientIp, isRateLimited, recordFailedAttempt, lockoutMinutesRemaining } from '@/lib/ratelimit'

export async function POST(req: NextRequest) {
  const { memberId, pin, email } = await req.json()

  if (!memberId || !pin || !email) {
    return NextResponse.json({ error: 'Member ID, PIN and email address are required' }, { status: 400 })
  }

  const ip = getClientIp(req)
  const identifier = `member:${memberId.trim().toLowerCase()}`

  // Rate limit check
  if (await isRateLimited(ip, identifier)) {
    const mins = await lockoutMinutesRemaining(ip, identifier)
    return NextResponse.json(
      { error: `Too many failed attempts. Please try again in ${mins} minute${mins === 1 ? '' : 's'}.` },
      { status: 429 }
    )
  }

  const emailNorm = email.trim().toLowerCase()

  // Validate against Bramley website
  const result = await loginMember(memberId.trim(), pin.trim())
  if (!result.success) {
    await recordFailedAttempt(ip, identifier)
    return NextResponse.json({ error: result.error }, { status: 401 })
  }

  // Check if we have a stored email for this member
  const existing = await sql`
    SELECT email, member_name FROM member_preferences WHERE member_id = ${memberId.trim()}
  `

  if (existing.length > 0) {
    const row = existing[0] as { email: string; member_name: string | null }
    if (row.email !== emailNorm) {
      await recordFailedAttempt(ip, identifier)
      return NextResponse.json({ error: 'Email address does not match our records for this member' }, { status: 401 })
    }
    // Update stored name if we scraped a better one; keep existing if scrape failed
    if (result.memberName) {
      await sql`
        UPDATE member_preferences SET member_name = ${result.memberName}, updated_at = NOW()
        WHERE member_id = ${memberId.trim()}
      `
    }
  } else {
    // First login — store their email and name
    await sql`
      INSERT INTO member_preferences (member_id, email, member_name)
      VALUES (${memberId.trim()}, ${emailNorm}, ${result.memberName ?? null})
    `
  }

  // Resolve best available name: scraped > stored > member ID
  const storedName = existing.length > 0
    ? (existing[0] as { member_name: string | null }).member_name
    : null
  const resolvedName = result.memberName ?? storedName ?? memberId.trim()

  const token = await signSession({
    type: 'member',
    memberId: memberId.trim(),
    memberName: resolvedName,
    memberEmail: emailNorm,
  })

  const cookieStore = await cookies()
  cookieStore.set('bci_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8,
    path: '/',
  })

  return NextResponse.json({ ok: true, memberName: resolvedName })
}
