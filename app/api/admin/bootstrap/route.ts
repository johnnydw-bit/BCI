import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { createHash } from 'crypto'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { pin, name, email } = await req.json()
  if (!pin || !name || !email) {
    return NextResponse.json({ error: 'pin, name and email are required' }, { status: 400 })
  }

  // Only allow if no Club Manager exists yet
  const existing = await sql`
    SELECT id FROM director_roles WHERE role = 'Club Manager' AND active = TRUE LIMIT 1
  `
  if (existing.length > 0) {
    return NextResponse.json({ error: 'A Club Manager already exists. Use the admin panel to manage directors.' }, { status: 409 })
  }

  const pinHash = createHash('sha256').update(pin.trim()).digest('hex')
  await sql`
    INSERT INTO director_roles (pin_hash, role, name, email)
    VALUES (${pinHash}, 'Club Manager', ${name}, ${email})
  `

  return NextResponse.json({ ok: true, message: `Club Manager "${name}" created successfully.` })
}
