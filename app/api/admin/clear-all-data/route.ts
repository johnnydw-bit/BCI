import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth'
import { sql } from '@/lib/db'

// Only Super Admin can wipe all submissions — too destructive for regular managers
export async function DELETE() {
  const cookieStore = await cookies()
  const token = cookieStore.get('bci_director_session')?.value
  const session = token ? await verifySession(token) : null

  if (!session || session.type !== 'director' || session.role !== 'Super Admin') {
    return NextResponse.json({ error: 'Forbidden — Super Admin only' }, { status: 403 })
  }

  const deleted = await sql`
    UPDATE submissions SET deleted_at = NOW()
    WHERE deleted_at IS NULL
    RETURNING id
  `

  // Soft-delete orphaned clusters (all their submissions are now deleted)
  await sql`
    UPDATE clusters SET deleted_at = NOW()
    WHERE deleted_at IS NULL
      AND id NOT IN (
        SELECT DISTINCT cluster_id FROM submissions
        WHERE cluster_id IS NOT NULL AND deleted_at IS NULL
      )
  `

  // Reset triage run state so next run picks up a clean batch
  await sql`UPDATE config SET value = 'false' WHERE key = 'TRIAGE_LOCK'`

  return NextResponse.json({ ok: true, deleted: deleted.length })
}
