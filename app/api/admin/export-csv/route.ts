import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth'
import { isManager } from '@/lib/categories'
import { sql } from '@/lib/db'
import { generateBackupCsv } from '@/lib/backup'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('bci_director_session')?.value
  const session = token ? await verifySession(token) : null

  if (!session || session.type !== 'director' || !isManager(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rows = await sql`
    SELECT * FROM submissions WHERE deleted_at IS NULL ORDER BY id ASC
  `

  const csv = generateBackupCsv(rows as Record<string, unknown>[])
  const filename = `bramley-backup-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

