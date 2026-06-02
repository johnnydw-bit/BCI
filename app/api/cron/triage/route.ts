import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { scoreBatch, ScoringResult, ScoringWeights, DEFAULT_WEIGHTS } from '@/lib/ai'
import { sendHAndSAlert, sendTriageReport, sendSubmitterUpdate } from '@/lib/email'
import { CATEGORIES, DIRECTOR_CATEGORIES } from '@/lib/categories'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const configRows = await sql`SELECT key, value FROM config`
  const config = Object.fromEntries(configRows.map((r) => [r.key as string, r.value as string]))

  const intervalDays = parseInt(config['TRIAGE_INTERVAL_DAYS'] ?? '7', 10)

  const weights: ScoringWeights = {
    memberImpact:      parseFloat(config['WEIGHT_MEMBER_IMPACT']    ?? String(DEFAULT_WEIGHTS.memberImpact)),
    strategic:         parseFloat(config['WEIGHT_STRATEGIC']         ?? String(DEFAULT_WEIGHTS.strategic)),
    feasibility:       parseFloat(config['WEIGHT_FEASIBILITY']       ?? String(DEFAULT_WEIGHTS.feasibility)),
    costBenefit:       parseFloat(config['WEIGHT_COST_BENEFIT']      ?? String(DEFAULT_WEIGHTS.costBenefit)),
    novelty:           parseFloat(config['WEIGHT_NOVELTY']           ?? String(DEFAULT_WEIGHTS.novelty)),
    experienceDelta:   parseFloat(config['WEIGHT_EXPERIENCE_DELTA']  ?? String(DEFAULT_WEIGHTS.experienceDelta)),
    multHs:            parseFloat(config['MULT_HS']                  ?? String(DEFAULT_WEIGHTS.multHs)),
    multBudgetYear:    parseFloat(config['MULT_BUDGET_YEAR']         ?? String(DEFAULT_WEIGHTS.multBudgetYear)),
    multMultiCategory: parseFloat(config['MULT_MULTI_CATEGORY']      ?? String(DEFAULT_WEIGHTS.multMultiCategory)),
    bandPriority:      parseFloat(config['BAND_PRIORITY']            ?? String(DEFAULT_WEIGHTS.bandPriority)),
    bandActive:        parseFloat(config['BAND_ACTIVE']              ?? String(DEFAULT_WEIGHTS.bandActive)),
    bandHolding:       parseFloat(config['BAND_HOLDING']             ?? String(DEFAULT_WEIGHTS.bandHolding)),
    bandLow:           parseFloat(config['BAND_LOW']                 ?? String(DEFAULT_WEIGHTS.bandLow)),
  }

  const ceilingMap: Record<string, number> = {
    course: parseFloat(config['CEILING_COURSE'] ?? '10'),
    competitions: parseFloat(config['CEILING_COMPETITIONS'] ?? '7'),
    clubhouse: parseFloat(config['CEILING_CLUBHOUSE'] ?? '8'),
    grounds: parseFloat(config['CEILING_GROUNDS'] ?? '6'),
    refreshments: parseFloat(config['CEILING_REFRESHMENTS'] ?? '4'),
    restaurant: parseFloat(config['CEILING_RESTAURANT'] ?? '5'),
    bar: parseFloat(config['CEILING_BAR'] ?? '6'),
    pro_shop: parseFloat(config['CEILING_PRO_SHOP'] ?? '3'),
  }

  const clusterBonuses = [
    parseFloat(config['CLUSTER_BONUS_2'] ?? '0.5'),
    parseFloat(config['CLUSTER_BONUS_3'] ?? '1.0'),
    parseFloat(config['CLUSTER_BONUS_4'] ?? '1.5'),
    parseFloat(config['CLUSTER_BONUS_5'] ?? '2.0'),
  ]

  const periodEnd = new Date()
  const periodStart = new Date(periodEnd)
  periodStart.setDate(periodStart.getDate() - intervalDays)

  const nextRunAt = new Date(periodEnd)
  nextRunAt.setDate(nextRunAt.getDate() + intervalDays)

  // Fetch unscored submissions
  const unscoredRows = await sql`
    SELECT s.id, s.description, s.benefit, s.category, s.impact, s.member_id,
           s.member_email, s.email_opt_out
    FROM submissions s
    WHERE s.scored_at IS NULL
    ORDER BY s.created_at ASC
  `

  const unscored = unscoredRows as Array<{
    id: number; description: string; benefit: string
    category: string; impact: number; member_id: string
    member_email: string | null; email_opt_out: boolean
  }>

  // Build scoring input with category ceilings
  const scoringInput = unscored.map((s) => ({
    id: s.id,
    description: s.description,
    benefit: s.benefit,
    category: s.category,
    impact: s.impact,
    categoryCeiling: ceilingMap[s.category] ?? CATEGORIES.find((c) => c.value === s.category)?.ceiling ?? 10,
  }))

  const results: ScoringResult[] = scoringInput.length > 0 ? await scoreBatch(scoringInput, weights) : []

  // Persist results and handle clusters
  const clusterMap = new Map<string, number>()

  for (const r of results) {
    let clusterId: number | null = null

    if (r.clusterTheme) {
      if (clusterMap.has(r.clusterTheme)) {
        clusterId = clusterMap.get(r.clusterTheme)!
        await sql`UPDATE clusters SET size = size + 1, updated_at = NOW() WHERE id = ${clusterId}`
      } else {
        const clusterRows = await sql`
          INSERT INTO clusters (theme) VALUES (${r.clusterTheme}) RETURNING id
        `
        clusterId = (clusterRows[0] as { id: number }).id
        clusterMap.set(r.clusterTheme, clusterId)
      }
    }

    // Apply consensus bonus
    let finalScore = r.score
    if (clusterId) {
      const clusterRow = await sql`SELECT size FROM clusters WHERE id = ${clusterId}`
      const size = (clusterRow[0] as { size: number })?.size ?? 1
      const bonus = size >= 5 ? 2.0 : size >= 4 ? 1.5 : size >= 3 ? 1.0 : size >= 2 ? 0.5 : 0
      finalScore = Math.min(10, finalScore + bonus)
    }

    // Derive threshold flags
    const costThresholdCommittee = parseFloat(config['COST_THRESHOLD_COMMITTEE'] ?? '5000')
    const costThresholdQuickwin = parseFloat(config['COST_THRESHOLD_QUICKWIN'] ?? '500')
    const implQuickwinWeeks = parseFloat(config['IMPL_QUICKWIN_WEEKS'] ?? '4')

    const costMidpoint = r.costEstimateHigh != null && r.costEstimateLow != null
      ? (r.costEstimateLow + r.costEstimateHigh) / 2 : null

    const costThresholdFlag = costMidpoint != null && costMidpoint > costThresholdCommittee
    const quickWinFlag = (costMidpoint == null || costMidpoint <= costThresholdQuickwin)
      && (r.implWeeksHigh == null || r.implWeeksHigh <= implQuickwinWeeks)
      && r.implComplexity === 'quick_win'

    // Suggested target date based on implementation time estimate
    const suggestedTargetDate = r.implWeeksHigh != null
      ? new Date(Date.now() + r.implWeeksHigh * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : null

    await sql`
      UPDATE submissions SET
        score = ${finalScore},
        score_band = ${r.scoreBand},
        member_msg = ${r.memberMsg},
        h_and_s_flag = ${r.hAndSFlag},
        cluster_id = ${clusterId},
        ai_summary = ${r.aiSummary},
        ai_narrative = ${r.aiNarrative},
        cost_band = ${r.costBand},
        cost_estimate_low = ${r.costEstimateLow},
        cost_estimate_high = ${r.costEstimateHigh},
        cost_confidence = ${r.costConfidence},
        cost_rationale = ${r.costRationale},
        impl_weeks_low = ${r.implWeeksLow},
        impl_weeks_high = ${r.implWeeksHigh},
        impl_complexity = ${r.implComplexity},
        suggested_target_date = ${suggestedTargetDate},
        cost_threshold_flag = ${costThresholdFlag},
        quick_win_flag = ${quickWinFlag},
        strategic_note = ${r.strategicNote},
        scored_at = NOW(),
        status = CASE WHEN ${r.alreadyInPlan} THEN 'rejected' ELSE status END
      WHERE id = ${r.submissionId}
    `

    // Immediate H&S notification
    // Apply consensus bonus using DB-configured values
    if (clusterId) {
      const clusterRow = await sql`SELECT size FROM clusters WHERE id = ${clusterId}`
      const size = clusterRow[0]?.size as number ?? 1
      const bonusIdx = Math.min(size - 2, clusterBonuses.length - 1)
      const bonus = size >= 2 ? (clusterBonuses[bonusIdx] ?? 0) : 0
      finalScore = Math.min(10, finalScore + bonus)
      await sql`UPDATE submissions SET score = ${finalScore}, score_band = ${results.find(x => x.submissionId === r.submissionId)?.scoreBand ?? ''} WHERE id = ${r.submissionId}`
    }

    if (r.hAndSFlag) {
      const sub = unscored.find((s) => s.id === r.submissionId)
      if (sub) {
        await sendHAndSAlert({
          id: sub.id,
          description: sub.description,
          category: sub.category,
          aiSummary: r.aiSummary,
        })
      }
    }

    // Email the submitter their assessment result
    const sub = unscored.find((s) => s.id === r.submissionId)
    if (sub?.member_email && !sub.email_opt_out) {
      try {
        await sendSubmitterUpdate(sub.member_email, {
          description: sub.description,
          scoreBand: r.scoreBand,
          memberMsg: r.memberMsg,
          costBand: r.costBand,
          implComplexity: r.implComplexity,
          suggestedTargetDate: r.implWeeksHigh != null
            ? new Date(Date.now() + r.implWeeksHigh * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            : null,
        })
      } catch (e) {
        console.error(`Failed to send submitter email for submission ${r.submissionId}:`, e)
      }
    }
  }

  // Record triage run
  const runRows = await sql`
    INSERT INTO triage_runs (period_start, period_end, next_run_at, submission_count, report_sent)
    VALUES (${periodStart.toISOString()}, ${periodEnd.toISOString()}, ${nextRunAt.toISOString()}, ${unscored.length}, FALSE)
    RETURNING id
  `
  const runId = (runRows[0] as { id: number }).id

  await sql`UPDATE submissions SET triage_run_id = ${runId} WHERE triage_run_id IS NULL AND scored_at IS NOT NULL`

  // Build and send triage report emails per role
  const scoredRows = await sql`
    SELECT s.*, c.theme AS cluster_theme, c.size AS cluster_size
    FROM submissions s
    LEFT JOIN clusters c ON c.id = s.cluster_id
    WHERE s.triage_run_id = ${runId}
    ORDER BY s.h_and_s_flag DESC, s.score DESC NULLS LAST
  `

  const directorEmails = await sql`SELECT role, email FROM director_roles WHERE active = TRUE`

  for (const director of directorEmails as Array<{ role: string; email: string }>) {
    const allowedCats = DIRECTOR_CATEGORIES[director.role] ?? []
    const directorSubs = (scoredRows as Array<Record<string, unknown>>).filter(
      (s) => allowedCats.includes(s.category as string)
    )
    if (directorSubs.length === 0) continue

    const htmlReport = buildEmailReport(directorSubs)
    await sendTriageReport([director.email], periodStart, periodEnd, nextRunAt, htmlReport)
  }

  await sql`UPDATE triage_runs SET report_sent = TRUE WHERE id = ${runId}`

  return NextResponse.json({ ok: true, scored: results.length, runId })
}

function buildEmailReport(submissions: Array<Record<string, unknown>>): string {
  const urgent = submissions.filter((s) => s.h_and_s_flag)
  const normal = submissions.filter((s) => !s.h_and_s_flag)

  let html = ''

  if (urgent.length > 0) {
    html += `<h3 style="color:#c0392b">⚠️ URGENT — Health &amp; Safety Items</h3>`
    html += urgent.map(rowHtml).join('')
  }

  html += `<h3>Suggestions (${normal.length})</h3>`
  html += normal.map(rowHtml).join('')

  return html
}

function rowHtml(s: Record<string, unknown>): string {
  return `
    <div style="border:1px solid #ddd;border-radius:8px;padding:12px;margin-bottom:8px">
      <strong>[${s.score ?? 'Pending'}]</strong> ${s.category} — ${s.ai_summary ?? s.description}
      ${s.cluster_theme ? `<span style="background:#2471a3;color:white;padding:2px 8px;border-radius:20px;font-size:11px;margin-left:8px">Cluster: ${s.cluster_theme}</span>` : ''}
      <p style="color:#555;font-size:13px;margin:6px 0 0">${s.ai_narrative ?? ''}</p>
    </div>
  `
}
