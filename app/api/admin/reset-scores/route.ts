import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth'
import { sql } from '@/lib/db'
import { isManager } from '@/lib/categories'

async function requireManager() {
  const cookieStore = await cookies()
  const token = cookieStore.get('bci_director_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session || session.type !== 'director' || !isManager(session.role)) return null
  return session
}

export async function POST(req: NextRequest) {
  if (!await requireManager()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { scope } = await req.json() as { scope: 'test' | 'all' }

  let result
  if (scope === 'test') {
    result = await sql`
      UPDATE submissions
      SET scored_at = NULL, score = NULL, score_band = NULL,
          triage_run_id = NULL, cluster_id = NULL,
          member_msg = NULL, h_and_s_flag = FALSE,
          cost_band = NULL, cost_estimate_low = NULL, cost_estimate_high = NULL,
          cost_confidence = NULL, cost_rationale = NULL,
          impl_complexity = NULL, impl_weeks_low = NULL, impl_weeks_high = NULL,
          suggested_target_date = NULL, cost_threshold_flag = FALSE,
          quick_win_flag = FALSE, suggested_owner = NULL,
          needs_external_approval = FALSE, approval_body = NULL,
          recurring_flag = FALSE, recurring_run_count = 0,
          seasonal_window = NULL, revenue_opportunity = FALSE, revenue_note = NULL,
          strategic_note = NULL, ai_summary = NULL, ai_narrative = NULL,
          status = 'new'
      WHERE test_data = TRUE AND deleted_at IS NULL
    `
  } else {
    result = await sql`
      UPDATE submissions
      SET scored_at = NULL, score = NULL, score_band = NULL,
          triage_run_id = NULL, cluster_id = NULL,
          member_msg = NULL, h_and_s_flag = FALSE,
          cost_band = NULL, cost_estimate_low = NULL, cost_estimate_high = NULL,
          cost_confidence = NULL, cost_rationale = NULL,
          impl_complexity = NULL, impl_weeks_low = NULL, impl_weeks_high = NULL,
          suggested_target_date = NULL, cost_threshold_flag = FALSE,
          quick_win_flag = FALSE, suggested_owner = NULL,
          needs_external_approval = FALSE, approval_body = NULL,
          recurring_flag = FALSE, recurring_run_count = 0,
          seasonal_window = NULL, revenue_opportunity = FALSE, revenue_note = NULL,
          strategic_note = NULL, ai_summary = NULL, ai_narrative = NULL,
          status = 'new'
      WHERE deleted_at IS NULL
    `
  }

  // Clean up orphaned clusters
  await sql`DELETE FROM clusters WHERE id NOT IN (SELECT DISTINCT cluster_id FROM submissions WHERE cluster_id IS NOT NULL)`

  return NextResponse.json({ ok: true, reset: result.length })
}

