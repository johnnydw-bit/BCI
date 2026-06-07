import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth'
import { sql } from '@/lib/db'
import { createHash, randomInt } from 'crypto'
import { isManager } from '@/lib/categories'

async function requireManager() {
  const cookieStore = await cookies()
  const token = cookieStore.get('bci_director_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session || session.type !== 'director' || !isManager(session.role)) return null
  return session
}

function generatePin(): string {
  // 6-digit numeric PIN
  return String(randomInt(100000, 999999))
}

export async function GET() {
  if (!await requireManager()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  // Never return pin_hash; return a placeholder so frontend knows PIN is set
  const rows = await sql`SELECT id, role, name, email, active, email_reports FROM director_roles ORDER BY name`
  return NextResponse.json({ directors: rows })
}

export async function POST(req: NextRequest) {
  if (!await requireManager()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json()

  // Reset all active director PINs at once
  if (body.resetAll) {
    const rows = await sql`SELECT id, name, role FROM director_roles WHERE active = TRUE ORDER BY name`
    const results: Array<{ name: string; role: string; pin: string }> = []
    for (const row of rows as Array<{ id: number; name: string; role: string }>) {
      const pin = generatePin()
      const pinHash = createHash('sha256').update(pin).digest('hex')
      await sql`UPDATE director_roles SET pin_hash = ${pinHash} WHERE id = ${row.id}`
      results.push({ name: row.name, role: row.role, pin })
    }
    return NextResponse.json({ ok: true, pins: results })
  }

  const { role, name, email } = body
  if (!role || !name || !email) {
    return NextResponse.json({ error: 'Role, name and email are required' }, { status: 400 })
  }
  // Generate a random PIN for new directors
  const pin = generatePin()
  const pinHash = createHash('sha256').update(pin).digest('hex')
  try {
    await sql`
      INSERT INTO director_roles (pin_hash, role, name, email)
      VALUES (${pinHash}, ${role}, ${name}, ${email})
    `
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return NextResponse.json({ error: 'A conflict occurred. Please try again.' }, { status: 409 })
    }
    throw e
  }
  // Return the plain PIN once so admin can communicate it to the director
  return NextResponse.json({ ok: true, pin })
}

export async function PATCH(req: NextRequest) {
  if (!await requireManager()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id, active, email_reports } = await req.json()
  if (active !== undefined) await sql`UPDATE director_roles SET active = ${active} WHERE id = ${id}`
  if (email_reports !== undefined) await sql`UPDATE director_roles SET email_reports = ${email_reports} WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}

export async function PUT(req: NextRequest) {
  if (!await requireManager()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id, name, email, role, resetPin } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await sql`UPDATE director_roles SET name = ${name}, email = ${email}, role = ${role} WHERE id = ${id}`
  if (resetPin) {
    const pin = generatePin()
    const pinHash = createHash('sha256').update(pin).digest('hex')
    try {
      await sql`UPDATE director_roles SET pin_hash = ${pinHash} WHERE id = ${id}`
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('unique') || msg.includes('duplicate')) {
        return NextResponse.json({ error: 'A PIN conflict occurred. Please try again.' }, { status: 409 })
      }
      throw e
    }
    // Return new PIN so admin can communicate it
    return NextResponse.json({ ok: true, newPin: pin })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  if (!await requireManager()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await req.json()
  await sql`DELETE FROM director_roles WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}

