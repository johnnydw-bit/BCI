import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth'
import { initDb } from '@/lib/db'
import { isManager } from '@/lib/categories'

export async function POST(req: NextRequest) {
  // Accept either a logged-in Club Manager session OR the cron secret (for CLI/automation use)
  const authHeader = req.headers.get('authorization')
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    await initDb()
    return NextResponse.json({ ok: true })
  }

  const cookieStore = await cookies()
  const token = cookieStore.get('bci_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session || session.type !== 'director' || !isManager(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await initDb()
  return NextResponse.json({ ok: true })
}
