import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth'
import { isManager } from '@/lib/categories'
import { sql } from '@/lib/db'
import { parseCsvRows } from '@/lib/backup'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('bci_director_session')?.value
  const session = token ? await verifySession(token) : null

  if (!session || session.type !== 'director' || !isManager(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const text = await file.text()
  const rows = parseCsvRows(text)

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No valid rows found in CSV' }, { status: 400 })
  }

  let upserted = 0
  for (const r of rows) {
    // Only restore core fields â€” don't overwrite AI-scored fields if already scored
    await sql`
      INSERT INTO submissions (
        id, member_id, member_name, recognition,
        description, benefit, category, impact,
        status, score, score_band, member_msg,
        h_and_s_flag, ai_summary, ai_narrative,
        cost_band, cost_estimate_low, cost_estimate_high, cost_confidence, cost_rationale,
        impl_complexity, impl_weeks_low, impl_weeks_high, suggested_target_date,
        cost_threshold_flag, quick_win_flag,
        suggested_owner, needs_external_approval, approval_body,
        recurring_flag, recurring_run_count, seasonal_window,
        revenue_opportunity, revenue_note, strategic_note,
        recognition_flagged, member_email, email_opt_out,
        moderation_reason, created_at, scored_at
      ) VALUES (
        ${num(r.id)}, ${r.member_id}, ${r.member_name ?? null}, ${r.recognition ?? 'anonymous'},
        ${r.description}, ${r.benefit}, ${r.category}, ${num(r.impact)},
        ${r.status ?? 'new'}, ${numOrNull(r.score)}, ${r.score_band ?? null}, ${r.member_msg ?? null},
        ${bool(r.h_and_s_flag)}, ${r.ai_summary ?? null}, ${r.ai_narrative ?? null},
        ${r.cost_band ?? null}, ${numOrNull(r.cost_estimate_low)}, ${numOrNull(r.cost_estimate_high)},
        ${r.cost_confidence ?? null}, ${r.cost_rationale ?? null},
        ${r.impl_complexity ?? null}, ${numOrNull(r.impl_weeks_low)}, ${numOrNull(r.impl_weeks_high)},
        ${r.suggested_target_date ?? null},
        ${bool(r.cost_threshold_flag)}, ${bool(r.quick_win_flag)},
        ${r.suggested_owner ?? null}, ${bool(r.needs_external_approval)}, ${r.approval_body ?? null},
        ${bool(r.recurring_flag)}, ${num(r.recurring_run_count) ?? 0}, ${r.seasonal_window ?? null},
        ${bool(r.revenue_opportunity)}, ${r.revenue_note ?? null}, ${r.strategic_note ?? null},
        ${bool(r.recognition_flagged)}, ${r.member_email ?? null}, ${bool(r.email_opt_out)},
        ${r.moderation_reason ?? null}, ${r.created_at ?? 'NOW()'}, ${r.scored_at ?? null}
      )
      ON CONFLICT (id) DO UPDATE SET
        status              = EXCLUDED.status,
        member_msg          = EXCLUDED.member_msg,
        score               = EXCLUDED.score,
        score_band          = EXCLUDED.score_band,
        h_and_s_flag        = EXCLUDED.h_and_s_flag,
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
        suggested_target_date = EXCLUDED.suggested_target_date,
        cost_threshold_flag = EXCLUDED.cost_threshold_flag,
        quick_win_flag      = EXCLUDED.quick_win_flag,
        suggested_owner     = EXCLUDED.suggested_owner,
        needs_external_approval = EXCLUDED.needs_external_approval,
        approval_body       = EXCLUDED.approval_body,
        recurring_flag      = EXCLUDED.recurring_flag,
        recurring_run_count = EXCLUDED.recurring_run_count,
        seasonal_window     = EXCLUDED.seasonal_window,
        revenue_opportunity = EXCLUDED.revenue_opportunity,
        revenue_note        = EXCLUDED.revenue_note,
        strategic_note      = EXCLUDED.strategic_note,
        scored_at           = EXCLUDED.scored_at
    `
    upserted++
  }

  // Reset the sequence so new submissions don't collide with restored IDs
  await sql`SELECT setval('submissions_id_seq', (SELECT MAX(id) FROM submissions))`

  return NextResponse.json({ ok: true, upserted })
}

function num(v: unknown): number | null {
  const n = Number(v)
  return isNaN(n) || v === '' || v == null ? null : n
}
function numOrNull(v: unknown): number | null { return num(v) }
function bool(v: unknown): boolean {
  if (v === 'true' || v === true || v === '1' || v === 1) return true
  return false
}

