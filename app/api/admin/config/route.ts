import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth'
import { sql } from '@/lib/db'
import { isManager } from '@/lib/categories'

async function requireManager() {
  const cookieStore = await cookies()
  const token = cookieStore.get('bci_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session || session.type !== 'director' || !isManager(session.role)) return null
  return session
}

export async function GET() {
  const session = await requireManager()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const rows = await sql`SELECT key, value, label FROM config ORDER BY key`
  return NextResponse.json({ config: rows, role: session.role, directorName: session.directorName })
}

export async function PATCH(req: NextRequest) {
  if (!await requireManager()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { updates } = await req.json() as { updates: Array<{ key: string; value: string }> }
  for (const { key, value } of updates) {
    await sql`UPDATE config SET value = ${value} WHERE key = ${key}`
  }
  return NextResponse.json({ ok: true })
}
