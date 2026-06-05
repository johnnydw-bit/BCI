import { NextRequest, NextResponse } from 'next/server'
import { signSession } from '@/lib/auth'
import { sql } from '@/lib/db'
import { cookies } from 'next/headers'
import { createHash } from 'crypto'
import { getClientIp, isRateLimited, recordFailedAttempt, lockoutMinutesRemaining } from '@/lib/ratelimit'

export async function POST(req: NextRequest) {
  const { pin } = await req.json()

  if (!pin) {
    return NextResponse.json({ error: 'PIN is required' }, { status: 400 })
  }

  const ip = getClientIp(req)
  const identifier = 'director'

  // Rate limit check
  if (await isRateLimited(ip, identifier)) {
    const mins = await lockoutMinutesRemaining(ip, identifier)
    return NextResponse.json(
      { error: `Too many failed attempts. Please try again in ${mins} minute${mins === 1 ? '' : 's'}.` },
      { status: 429 }
    )
  }

  const pinHash = createHash('sha256').update(pin.trim()).digest('hex')

  const rows = await sql`
    SELECT role, name, email FROM director_roles
    WHERE pin_hash = ${pinHash} AND active = TRUE
    LIMIT 1
  `

  if (rows.length === 0) {
    await recordFailedAttempt(ip, identifier)
    return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 })
  }

  const director = rows[0] as { role: string; name: string; email: string }

  const token = await signSession({
    type: 'director',
    role: director.role,
    directorName: director.name,
    email: director.email,
  })

  const cookieStore = await cookies()
  cookieStore.set('bci_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8,
    path: '/',
  })

  return NextResponse.json({ ok: true, role: director.role, name: director.name })
}
