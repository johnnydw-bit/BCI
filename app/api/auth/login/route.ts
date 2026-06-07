import { NextRequest, NextResponse } from 'next/server'
import { signSession } from '@/lib/auth'
import { sql } from '@/lib/db'
import { cookies } from 'next/headers'
import { getClientIp, isRateLimited, recordFailedAttempt, lockoutMinutesRemaining } from '@/lib/ratelimit'

export async function POST(req: NextRequest) {
  const { name, email } = await req.json()

  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: 'Name and email address are required' }, { status: 400 })
  }

  const emailNorm = email.trim().toLowerCase()
  const nameTrimmed = name.trim()

  const ip = getClientIp(req)
  const identifier = `member:${emailNorm}`

  if (await isRateLimited(ip, identifier)) {
    const mins = await lockoutMinutesRemaining(ip, identifier)
    return NextResponse.json(
      { error: `Too many attempts. Please try again in ${mins} minute${mins === 1 ? '' : 's'}.` },
      { status: 429 }
    )
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
    await recordFailedAttempt(ip, identifier)
    return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
  }

  // Store / update name and email in member_preferences
  await sql`
    INSERT INTO member_preferences (member_id, email, member_name)
    VALUES (${emailNorm}, ${emailNorm}, ${nameTrimmed})
    ON CONFLICT (member_id) DO UPDATE SET
      member_name = ${nameTrimmed},
      updated_at  = NOW()
  `

  const token = await signSession({
    type: 'member',
    memberId: emailNorm,
    memberName: nameTrimmed,
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

  return NextResponse.json({ ok: true, memberName: nameTrimmed })
}
