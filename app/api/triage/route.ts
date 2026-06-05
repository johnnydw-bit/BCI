import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth'
import { sql } from '@/lib/db'
import { DIRECTOR_CATEGORIES, isManager } from '@/lib/categories'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('bci_session')?.value
  const session = token ? await verifySession(token) : null

  if (!session || session.type !== 'director') {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
  }

  const allowedCategories = DIRECTOR_CATEGORIES[session.role] ?? []

  const rows = await sql`
    SELECT
      s.id, s.description, s.benefit, s.category, s.impact,
      s.status, s.score, s.score_band, s.h_and_s_flag,
      s.cluster_id, s.ai_summary, s.ai_narrative,
      s.cost_band, s.cost_estimate_low, s.cost_estimate_high,
      s.cost_confidence, s.cost_rationale, s.cost_threshold_flag, s.quick_win_flag,
      s.impl_weeks_low, s.impl_weeks_high, s.impl_complexity, s.suggested_target_date,
      s.strategic_note, s.member_msg,
      s.recognition, s.member_name, s.created_at, s.scored_at,
      s.moderation_reason,
      s.suggested_owner, s.needs_external_approval, s.approval_body,
      s.recurring_flag, s.recurring_run_count,
      s.seasonal_window, s.revenue_opportunity, s.revenue_note,
      c.theme AS cluster_theme, c.size AS cluster_size
    FROM submissions s
    LEFT JOIN clusters c ON c.id = s.cluster_id
    WHERE s.category = ANY(${allowedCategories})
      AND s.deleted_at IS NULL
    ORDER BY s.h_and_s_flag DESC, s.score DESC NULLS LAST, s.created_at DESC
  `

  return NextResponse.json({
    role: session.role,
    directorName: session.directorName,
    submissions: rows,
    isManager: isManager(session.role),
  })
}

export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('bci_session')?.value
  const session = token ? await verifySession(token) : null

  if (!session || session.type !== 'director' || !isManager(session.role)) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
  }

  const { id, status, category } = await req.json()

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  if (status) {
    const validStatuses = ['new', 'under_consideration', 'approved', 'implemented', 'rejected']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const current = await sql`SELECT status FROM submissions WHERE id = ${id}`
    const oldStatus = (current[0] as { status: string })?.status

    await sql`UPDATE submissions SET status = ${status} WHERE id = ${id}`
    await sql`
      INSERT INTO status_log (submission_id, old_status, new_status, changed_by)
      VALUES (${id}, ${oldStatus}, ${status}, ${session.directorName})
    `
  }

  if (category) {
    await sql`UPDATE submissions SET category = ${category} WHERE id = ${id}`
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('bci_session')?.value
  const session = token ? await verifySession(token) : null

  if (!session || session.type !== 'director' || !isManager(session.role)) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
  }

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // Only allow delete of non-approved, non-implemented items
  const row = await sql`SELECT status FROM submissions WHERE id = ${id}`
  const status = (row[0] as { status: string })?.status
  if (status === 'approved' || status === 'implemented') {
    return NextResponse.json({ error: 'Cannot delete approved or implemented improvements' }, { status: 409 })
  }

  await sql`UPDATE submissions SET deleted_at = NOW() WHERE id = ${id}`
  await sql`
    INSERT INTO status_log (submission_id, old_status, new_status, changed_by, note)
    VALUES (${id}, ${status}, 'deleted', ${session.directorName}, 'Soft deleted by manager')
  `

  return NextResponse.json({ ok: true })
}
