import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth'
import { isManager } from '@/lib/categories'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('bci_director_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session || session.type !== 'director' || !isManager(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({
    EMAIL_FROM:     process.env.EMAIL_FROM     ?? '(not set)',
    DEBUG_EMAIL:    process.env.DEBUG_EMAIL    ?? '(not set)',
    MANAGER_EMAIL:  process.env.MANAGER_EMAIL  ?? '(not set)',
    RESEND_API_KEY: process.env.RESEND_API_KEY ? `set (${process.env.RESEND_API_KEY.slice(0, 8)}â€¦)` : '(not set)',
  })
}

