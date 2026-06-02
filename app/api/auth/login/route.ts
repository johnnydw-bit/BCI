import { NextRequest, NextResponse } from 'next/server'
import { loginMember, signSession } from '@/lib/auth'
import { sql } from '@/lib/db'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  const { memberId, pin, email } = await req.json()

  if (!memberId || !pin || !email) {
    return NextResponse.json({ error: 'Member ID, PIN and email address are required' }, { status: 400 })
  }

  const emailNorm = email.trim().toLowerCase()

  // Validate against Bramley website
  const result = await loginMember(memberId.trim(), pin.trim())
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 401 })
  }

  // Check if we have a stored email for this member
  const existing = await sql`
    SELECT email FROM member_preferences WHERE member_id = ${memberId.trim()}
  `

  if (existing.length > 0) {
    const storedEmail = (existing[0] as { email: string }).email
    if (storedEmail !== emailNorm) {
      return NextResponse.json({ error: 'Email address does not match our records for this member' }, { status: 401 })
    }
  } else {
    // First login — store their email
    await sql`
      INSERT INTO member_preferences (member_id, email)
      VALUES (${memberId.trim()}, ${emailNorm})
    `
  }

  const token = await signSession({
    type: 'member',
    memberId: memberId.trim(),
    memberName: result.memberName ?? memberId,
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

  return NextResponse.json({ ok: true, memberName: result.memberName })
}
