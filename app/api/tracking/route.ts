import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth'
import { sql } from '@/lib/db'
import { DIRECTOR_CATEGORIES, isManager } from '@/lib/categories'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('bci_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session || session.type !== 'director') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const allowedCategories = DIRECTOR_CATEGORIES[session.role] ?? []

  const rows = await sql`
    SELECT
      id, description, category, status, score, score_band,
      ai_summary, cost_band, actual_cost,
      cost_estimate_low, cost_estimate_high,
      impl_complexity, impl_weeks_low, impl_weeks_high, suggested_target_date,
      quick_win_flag, cost_threshold_flag,
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
  if (!session || session.type !== 'director' || !isManager(session.role)) {
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

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('bci_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session || session.type !== 'director' || !isManager(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const row = await sql`SELECT status, recognition, member_name FROM submissions WHERE id = ${id}`
  const current = row[0] as { status: string; recognition: string; member_name: string }

  if (current.status !== 'approved') {
    return NextResponse.json({ error: 'Only approved improvements can be marked complete' }, { status: 409 })
  }

  await sql`
    UPDATE submissions SET
      status = 'implemented',
      completed_at = NOW(),
      recognition_flagged = CASE WHEN recognition != 'anonymous' THEN TRUE ELSE FALSE END
    WHERE id = ${id}
  `

  await sql`
    INSERT INTO status_log (submission_id, old_status, new_status, changed_by, note)
    VALUES (${id}, 'approved', 'implemented', ${session.directorName}, 'Marked complete via tracking')
  `

  return NextResponse.json({
    ok: true,
    recognitionRequired: current.recognition !== 'anonymous',
    memberName: current.member_name,
  })
}
