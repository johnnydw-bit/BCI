import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth'
import { sql } from '@/lib/db'

// Full JSON restore — Super Admin only
export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('bci_director_session')?.value
  const session = token ? await verifySession(token) : null

  if (!session || session.type !== 'director' || session.role !== 'Super Admin') {
    return NextResponse.json({ error: 'Forbidden — Super Admin only' }, { status: 403 })
  }

  let bundle: {
    version?: number
    submissions?: Record<string, unknown>[]
    clusters?: Record<string, unknown>[]
    status_log?: Record<string, unknown>[]
    triage_runs?: Record<string, unknown>[]
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    const text = await file.text()
    bundle = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON file' }, { status: 400 })
  }

  if (!bundle.submissions) {
    return NextResponse.json({ error: 'File does not look like a BCI backup — missing submissions' }, { status: 400 })
  }

  let submissionsRestored = 0
  let clustersRestored = 0
  let logsRestored = 0

  // Restore clusters first (submissions FK reference cluster_id)
  for (const c of bundle.clusters ?? []) {
    await sql`
      INSERT INTO clusters (id, theme, size, created_at, deleted_at)
      VALUES (
        ${n(c.id)}, ${s(c.theme)}, ${n(c.size) ?? 1},
        ${s(c.created_at) ?? 'NOW()'}, ${s(c.deleted_at) ?? null}
      )
      ON CONFLICT (id) DO UPDATE SET
        theme      = EXCLUDED.theme,
        size       = EXCLUDED.size,
        deleted_at = EXCLUDED.deleted_at
    `
    clustersRestored++
  }

  // Restore submissions
  for (const r of bundle.submissions) {
    await sql`
      INSERT INTO submissions (
        id, member_id, member_name, recognition, member_email, email_opt_out,
        description, benefit, category, impact,
        status, score, score_band, score_override, score_override_reason, score_override_by,
        member_msg, h_and_s_flag, already_in_plan, cluster_id,
        ai_summary, ai_narrative,
        cost_band, cost_estimate_low, cost_estimate_high, cost_confidence, cost_rationale,
        impl_complexity, impl_weeks_low, impl_weeks_high, suggested_target_date, confirmed_target_date,
        confirmed_cost, decision_authority, decision_by,
        cost_threshold_flag, quick_win_flag,
        suggested_owner, needs_external_approval, approval_body,
        notes, related_submission_ids,
        recurring_flag, recurring_run_count, seasonal_window,
        revenue_opportunity, revenue_note, strategic_note,
        recognition_flagged, moderation_reason, prior_rejection_ids,
        already_in_plan_note, test_data, budget_request_id, budget_year,
        created_at, scored_at, deleted_at, withdrawn_at
      ) VALUES (
        ${n(r.id)}, ${s(r.member_id)}, ${s(r.member_name)}, ${s(r.recognition) ?? 'anonymous'},
        ${s(r.member_email)}, ${b(r.email_opt_out)},
        ${s(r.description)}, ${s(r.benefit)}, ${s(r.category)}, ${n(r.impact)},
        ${s(r.status) ?? 'new'}, ${n(r.score)}, ${s(r.score_band)},
        ${n(r.score_override)}, ${s(r.score_override_reason)}, ${s(r.score_override_by)},
        ${s(r.member_msg)}, ${b(r.h_and_s_flag)}, ${b(r.already_in_plan)}, ${n(r.cluster_id)},
        ${s(r.ai_summary)}, ${s(r.ai_narrative)},
        ${s(r.cost_band)}, ${n(r.cost_estimate_low)}, ${n(r.cost_estimate_high)},
        ${s(r.cost_confidence)}, ${s(r.cost_rationale)},
        ${s(r.impl_complexity)}, ${n(r.impl_weeks_low)}, ${n(r.impl_weeks_high)},
        ${s(r.suggested_target_date)}, ${s(r.confirmed_target_date)},
        ${n(r.confirmed_cost)}, ${s(r.decision_authority)}, ${s(r.decision_by)},
        ${b(r.cost_threshold_flag)}, ${b(r.quick_win_flag)},
        ${s(r.suggested_owner)}, ${b(r.needs_external_approval)}, ${s(r.approval_body)},
        ${s(r.notes)}, ${arr(r.related_submission_ids)},
        ${b(r.recurring_flag)}, ${n(r.recurring_run_count) ?? 0}, ${s(r.seasonal_window)},
        ${b(r.revenue_opportunity)}, ${s(r.revenue_note)}, ${s(r.strategic_note)},
        ${b(r.recognition_flagged)}, ${s(r.moderation_reason)}, ${arr(r.prior_rejection_ids)},
        ${s(r.already_in_plan_note)}, ${b(r.test_data)}, ${n(r.budget_request_id)}, ${n(r.budget_year)},
        ${s(r.created_at) ?? 'NOW()'}, ${s(r.scored_at)}, ${s(r.deleted_at)}, ${s(r.withdrawn_at)}
      )
      ON CONFLICT (id) DO UPDATE SET
        status              = EXCLUDED.status,
        score               = EXCLUDED.score,
        score_band          = EXCLUDED.score_band,
        score_override      = EXCLUDED.score_override,
        score_override_reason = EXCLUDED.score_override_reason,
        score_override_by   = EXCLUDED.score_override_by,
        member_msg          = EXCLUDED.member_msg,
        h_and_s_flag        = EXCLUDED.h_and_s_flag,
        already_in_plan     = EXCLUDED.already_in_plan,
        cluster_id          = EXCLUDED.cluster_id,
        ai_summary          = EXCLUDED.ai_summary,
        ai_narrative        = EXCLUDED.ai_narrative,
        cost_band           = EXCLUDED.cost_band,
        cost_estimate_low   = EXCLUDED.cost_estimate_low,
        cost_estimate_high  = EXCLUDED.cost_estimate_high,
        cost_confidence     = EXCLUDED.cost_confidence,
        cost_rationale      = EXCLUDED.cost_rationale,
        impl_complexity     = EXCLUDED.impl_complexity,
        impl_weeks_low      = EXCLUDED.impl_weeks_low,
        impl_weeks_high     = EXCLUDED.impl_weeks_high,
        confirmed_target_date = EXCLUDED.confirmed_target_date,
        confirmed_cost      = EXCLUDED.confirmed_cost,
        decision_authority  = EXCLUDED.decision_authority,
        decision_by         = EXCLUDED.decision_by,
        cost_threshold_flag = EXCLUDED.cost_threshold_flag,
        quick_win_flag      = EXCLUDED.quick_win_flag,
        suggested_owner     = EXCLUDED.suggested_owner,
        needs_external_approval = EXCLUDED.needs_external_approval,
        approval_body       = EXCLUDED.approval_body,
        notes               = EXCLUDED.notes,
        suggested_target_date = EXCLUDED.suggested_target_date,
        related_submission_ids = EXCLUDED.related_submission_ids,
        recurring_flag      = EXCLUDED.recurring_flag,
        recurring_run_count = EXCLUDED.recurring_run_count,
        seasonal_window     = EXCLUDED.seasonal_window,
        revenue_opportunity = EXCLUDED.revenue_opportunity,
        revenue_note        = EXCLUDED.revenue_note,
        strategic_note      = EXCLUDED.strategic_note,
        scored_at           = EXCLUDED.scored_at,
        deleted_at          = EXCLUDED.deleted_at,
        withdrawn_at        = EXCLUDED.withdrawn_at,
        budget_request_id   = EXCLUDED.budget_request_id,
        budget_year         = EXCLUDED.budget_year
    `
    submissionsRestored++
  }

  // Restore status log
  for (const l of bundle.status_log ?? []) {
    await sql`
      INSERT INTO status_log (id, submission_id, old_status, new_status, changed_by, note, changed_at)
      VALUES (
        ${n(l.id)}, ${n(l.submission_id)}, ${s(l.old_status)}, ${s(l.new_status)},
        ${s(l.changed_by)}, ${s(l.note)}, ${s(l.changed_at) ?? 'NOW()'}
      )
      ON CONFLICT (id) DO NOTHING
    `
    logsRestored++
  }

  // Reset sequences so new inserts don't collide with restored IDs
  await sql`SELECT setval('submissions_id_seq', COALESCE((SELECT MAX(id) FROM submissions), 0))`
  await sql`SELECT setval('clusters_id_seq', COALESCE((SELECT MAX(id) FROM clusters), 0))`
  await sql`SELECT setval('status_log_id_seq', COALESCE((SELECT MAX(id) FROM status_log), 0))`

  return NextResponse.json({ ok: true, submissionsRestored, clustersRestored, logsRestored })
}

function s(v: unknown): string | null {
  if (v == null || v === '') return null
  return String(v)
}
function n(v: unknown): number | null {
  const num = Number(v)
  return v == null || v === '' || isNaN(num) ? null : num
}
function b(v: unknown): boolean {
  return v === true || v === 'true' || v === 1 || v === '1'
}
function arr(v: unknown): string {
  if (Array.isArray(v)) return `{${v.join(',')}}`
  if (v == null) return '{}'
  return String(v)
}
