import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth'
import { isManager } from '@/lib/categories'
import { sql } from '@/lib/db'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('bci_director_session')?.value
  const session = token ? await verifySession(token) : null

  if (!session || session.type !== 'director' || !isManager(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [submissions, clusters, triageRuns, statusLog, config, directors] = await Promise.all([
    sql`SELECT * FROM submissions ORDER BY id ASC`,
    sql`SELECT * FROM clusters ORDER BY id ASC`,
    sql`SELECT * FROM triage_runs ORDER BY id ASC`,
    sql`SELECT * FROM status_log ORDER BY id ASC`,
    sql`SELECT key, value, label FROM config ORDER BY key`,
    sql`SELECT id, role, name, email, active, email_reports FROM director_roles ORDER BY id ASC`,
  ])

  const bundle = {
    exported_at: new Date().toISOString(),
    exported_by: session.directorName,
    version: 1,
    submissions,
    clusters,
    triage_runs: triageRuns,
    status_log: statusLog,
    config,
    directors,
  }

  const filename = `bramley-full-backup-${new Date().toISOString().slice(0, 10)}.json`

  return new NextResponse(JSON.stringify(bundle, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

