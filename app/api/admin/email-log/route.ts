import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function GET(req: Request) {
  const token = (await cookies()).get('session')?.value
  const session = token ? await verifySession(token) : null
  if (!session || session.type !== 'director') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? 100), 500)
  const offset = Number(searchParams.get('offset') ?? 0)

  const rows = await sql`
    SELECT id, type, recipient, submission_id, resend_id, sent_at
    FROM email_log
    ORDER BY sent_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `

  const [{ total }] = await sql`SELECT COUNT(*)::int AS total FROM email_log`

  return NextResponse.json({ logs: rows, total })
}
