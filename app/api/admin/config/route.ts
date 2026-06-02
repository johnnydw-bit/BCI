import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth'
import { sql } from '@/lib/db'

async function requireManager() {
  const cookieStore = await cookies()
  const token = cookieStore.get('bci_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session || session.type !== 'director' || session.role !== 'Club Manager') return null
  return session
}

export async function GET() {
  if (!await requireManager()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const rows = await sql`SELECT key, value, label FROM config ORDER BY key`
  return NextResponse.json({ config: rows })
}

export async function PATCH(req: NextRequest) {
  if (!await requireManager()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { updates } = await req.json() as { updates: Array<{ key: string; value: string }> }
  for (const { key, value } of updates) {
    await sql`UPDATE config SET value = ${value} WHERE key = ${key}`
  }
  return NextResponse.json({ ok: true })
}
