import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth'
import { sql } from '@/lib/db'
import { DIRECTOR_CATEGORIES } from '@/lib/categories'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('bci_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session || session.type !== 'director') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const allowedCategories = DIRECTOR_CATEGORIES[session.role] ?? []

  const rows = await sql`
    SELECT
      id, description, category, status, score, score_band,
      ai_summary, cost_band, actual_cost, estimated_cost_value,
      target_date, responsible_person, budget_year, tracking_notes,
      recognition, member_name, created_at, scored_at,
      cluster_theme, cluster_size, h_and_s_flag, moderation_reason
    FROM (
      SELECT s.*,
        c.theme AS cluster_theme, c.size AS cluster_size
      FROM submissions s
      LEFT JOIN clusters c ON c.id = s.cluster_id
      WHERE s.category = ANY(${allowedCategories})
        AND s.status IN ('approved', 'implemented')
    ) t
    ORDER BY target_date ASC NULLS LAST, score DESC NULLS LAST
  `

  return NextResponse.json({ improvements: rows })
}

export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('bci_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session || session.type !== 'director' || session.role !== 'Club Manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id, target_date, responsible_person, budget_year, actual_cost, tracking_notes } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await sql`
    UPDATE submissions SET
      target_date       = ${target_date ?? null},
      responsible_person = ${responsible_person ?? null},
      budget_year       = ${budget_year ?? null},
      actual_cost       = ${actual_cost ?? null},
      tracking_notes    = ${tracking_notes ?? null}
    WHERE id = ${id}
  `

  return NextResponse.json({ ok: true })
}
