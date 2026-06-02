import { NextRequest, NextResponse } from 'next/server'
import { loginMember, signSession } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  const { memberId, pin } = await req.json()

  if (!memberId || !pin) {
    return NextResponse.json({ error: 'Member ID and PIN are required' }, { status: 400 })
  }

  const result = await loginMember(memberId.trim(), pin.trim())

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 401 })
  }

  const token = await signSession({
    type: 'member',
    memberId: memberId.trim(),
    memberName: result.memberName ?? memberId,
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
