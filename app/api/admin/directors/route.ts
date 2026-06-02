import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth'
import { sql } from '@/lib/db'
import { createHash } from 'crypto'

async function requireManager() {
  const cookieStore = await cookies()
  const token = cookieStore.get('bci_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session || session.type !== 'director' || session.role !== 'Club Manager') return null
  return session
}

export async function GET() {
  if (!await requireManager()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const rows = await sql`SELECT id, role, name, email, active FROM director_roles ORDER BY name`
  return NextResponse.json({ directors: rows })
}

export async function POST(req: NextRequest) {
  if (!await requireManager()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { pin, role, name, email } = await req.json()
  if (!pin || !role || !name || !email) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 })
  }
  const pinHash = createHash('sha256').update(pin.trim()).digest('hex')
  await sql`
    INSERT INTO director_roles (pin_hash, role, name, email)
    VALUES (${pinHash}, ${role}, ${name}, ${email})
  `
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  if (!await requireManager()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id, active } = await req.json()
  await sql`UPDATE director_roles SET active = ${active} WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  if (!await requireManager()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await req.json()
  await sql`DELETE FROM director_roles WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
