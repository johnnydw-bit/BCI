import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth'
import { runTriage } from '@/lib/triage'
import { isManager } from '@/lib/categories'

export async function POST() {
  const cookieStore = await cookies()
  const token = cookieStore.get('bci_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session || session.type !== 'director' || !isManager(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const result = await runTriage()
  return NextResponse.json({ ok: true, ...result })
}
