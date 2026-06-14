import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { sendOwnerNudge } from '@/lib/email'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Find submissions assigned to an owner, in an active status, with no status change in 14+ days
  const rows = await sql`
    SELECT
      s.id,
      s.description,
      s.status,
      s.suggested_owner,
      dr.email AS owner_email,
      EXTRACT(DAY FROM NOW() - MAX(sl.changed_at))::int AS days_since_update
    FROM submissions s
    JOIN director_roles dr ON dr.name = s.suggested_owner AND dr.active = TRUE AND dr.email IS NOT NULL
    LEFT JOIN status_log sl ON sl.submission_id = s.id
    WHERE s.suggested_owner IS NOT NULL
      AND s.status IN ('approved', 'in_plan')
      AND s.deleted_at IS NULL
      AND s.withdrawn_at IS NULL
    GROUP BY s.id, s.description, s.status, s.suggested_owner, dr.email
    HAVING EXTRACT(DAY FROM NOW() - MAX(sl.changed_at)) >= 14
       OR MAX(sl.changed_at) IS NULL
    ORDER BY s.suggested_owner, s.id
  `

  if (rows.length === 0) {
    console.log('[cron/nudge] No stale assigned submissions')
    return NextResponse.json({ ok: true, nudged: 0 })
  }

  // Group by owner
  const byOwner = new Map<string, { name: string; email: string; items: Array<{ id: number; description: string; status: string; daysSinceUpdate: number }> }>()
  for (const r of rows as Array<{ id: number; description: string; status: string; suggested_owner: string; owner_email: string; days_since_update: number }>) {
    if (!byOwner.has(r.suggested_owner)) {
      byOwner.set(r.suggested_owner, { name: r.suggested_owner, email: r.owner_email, items: [] })
    }
    byOwner.get(r.suggested_owner)!.items.push({
      id: r.id,
      description: r.description,
      status: r.status,
      daysSinceUpdate: r.days_since_update ?? 999,
    })
  }

  let nudged = 0
  for (const owner of byOwner.values()) {
    try {
      await sendOwnerNudge(owner.email, { ownerName: owner.name, submissions: owner.items })
      console.log(`[cron/nudge] Sent nudge to ${owner.name} (${owner.items.length} items)`)
      nudged++
    } catch (e) {
      console.error(`[cron/nudge] Failed to send to ${owner.name}:`, e)
    }
  }

  return NextResponse.json({ ok: true, nudged, total: rows.length })
}
