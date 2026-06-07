import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth'
import { isManager } from '@/lib/categories'
import { sql } from '@/lib/db'

export async function DELETE() {
  const cookieStore = await cookies()
  const token = cookieStore.get('bci_director_session')?.value
  const session = token ? await verifySession(token) : null

  if (!session || session.type !== 'director' || !isManager(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Remove test submissions and any clusters that only had test submissions
  const deleted = await sql`
    DELETE FROM submissions WHERE test_data = TRUE RETURNING id
  `

  // Clean up any now-empty clusters
  await sql`
    DELETE FROM clusters
    WHERE id NOT IN (SELECT DISTINCT cluster_id FROM submissions WHERE cluster_id IS NOT NULL)
  `

  return NextResponse.json({ ok: true, deleted: deleted.length })
}

