import { sql } from '@/lib/db'
import { scoreBatch, ScoringResult, ScoringWeights, DEFAULT_WEIGHTS } from '@/lib/ai'
import { sendHAndSAlert, sendTriageReport, sendSubmitterUpdate, sendHighScoreAlert } from '@/lib/email'
import { CATEGORIES, DIRECTOR_CATEGORIES, STATUS_LABELS } from '@/lib/categories'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bramley-bci.vercel.app'
const LOGO_URL = `${APP_URL}/bramley-logo.jpg`

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label])
)

export async function runTriage(): Promise<{ scored: number; runId: number }> {
  // Atomic lock: only proceed if TRIAGE_LOCK is currently 'false'
  // This prevents two simultaneous runs (e.g. cron + manual trigger at the same time)
  const locked = await sql`
    UPDATE config SET value = 'true'
    WHERE key = 'TRIAGE_LOCK' AND value = 'false'
    RETURNING key
  `
  if (locked.length === 0) {
    console.log('[triage] Already running — skipping duplicate invocation')
    throw new Error('Triage is already running. Please wait for the current run to finish.')
  }

  try {
    return await _runTriage()
  } finally {
    await sql`UPDATE config SET value = 'false' WHERE key = 'TRIAGE_LOCK'`
    console.log('[triage] Lock released')
  }
}

async function _runTriage(): Promise<{ scored: number; runId: number }> {
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
    course:       parseFloat(config['CEILING_COURSE']        ?? '10'),
    competitions: parseFloat(config['CEILING_COMPETITIONS']  ?? '7'),
    clubhouse:    parseFloat(config['CEILING_CLUBHOUSE']     ?? '8'),
    grounds:      parseFloat(config['CEILING_GROUNDS']       ?? '6'),
    refreshments: parseFloat(config['CEILING_REFRESHMENTS']  ?? '4'),
    restaurant:   parseFloat(config['CEILING_RESTAURANT']    ?? '5'),
    bar:          parseFloat(config['CEILING_BAR']           ?? '6'),
    pro_shop:     parseFloat(config['CEILING_PRO_SHOP']      ?? '3'),
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
           s.member_email, s.member_name,
           COALESCE(s.email_opt_out, FALSE) AS email_opt_out,
           s.ai_assessed_at,
           s.score, s.score_band, s.member_msg, s.h_and_s_flag,
           s.ai_summary, s.ai_narrative, s.cost_band,
           s.cost_estimate_low, s.cost_estimate_high, s.cost_confidence, s.cost_rationale,
           s.impl_weeks_low, s.impl_weeks_high, s.impl_complexity,
           s.suggested_target_date, s.strategic_note, s.suggested_owner,
           s.needs_external_approval, s.approval_body,
           s.seasonal_window, s.revenue_opportunity, s.revenue_note
    FROM submissions s
    WHERE s.scored_at IS NULL
      AND s.deleted_at IS NULL
    ORDER BY s.created_at ASC
  `

  const unscored = unscoredRows as Array<{
    id: number; description: string; benefit: string
    category: string; impact: number; member_id: string
    member_email: string | null; member_name: string | null; email_opt_out: boolean
    ai_assessed_at: string | null
    score: number | null; score_band: string | null; member_msg: string | null
    h_and_s_flag: boolean; ai_summary: string | null; ai_narrative: string | null
    cost_band: string | null; cost_estimate_low: number | null; cost_estimate_high: number | null
    cost_confidence: string | null; cost_rationale: string | null
    impl_weeks_low: number | null; impl_weeks_high: number | null; impl_complexity: string | null
    suggested_target_date: string | null; strategic_note: string | null; suggested_owner: string | null
    needs_external_approval: boolean; approval_body: string | null
    seasonal_window: string | null; revenue_opportunity: boolean; revenue_note: string | null
  }>

  // Submissions already AI-assessed at submission time — skip re-scoring, just cluster them
  const preAssessed = unscored.filter((s) => s.ai_assessed_at !== null)
  const needsScoring = unscored.filter((s) => s.ai_assessed_at === null)

  const scoringInput = needsScoring.map((s) => ({
    id: s.id,
    description: s.description,
    benefit: s.benefit,
    category: s.category,
    impact: s.impact,
    categoryCeiling: ceilingMap[s.category] ?? CATEGORIES.find((c) => c.value === s.category)?.ceiling ?? 10,
  }))

  // Fetch prior not-progressed submissions as context for similarity detection
  // Cap at 100 most recent to keep prompt size manageable
  const priorRejectedRows = await sql`
    SELECT id, description, category, scored_at AS rejected_at
    FROM submissions
    WHERE status = 'rejected'
      AND scored_at IS NOT NULL
      AND deleted_at IS NULL
      AND withdrawn_at IS NULL
    ORDER BY scored_at DESC
    LIMIT 100
  `
  const priorRejected = priorRejectedRows as Array<{ id: number; description: string; category: string; rejected_at: string }>

  const freshResults: ScoringResult[] = scoringInput.length > 0 ? await scoreBatch(scoringInput, weights, priorRejected) : []

  // Reconstruct ScoringResult shape for pre-assessed submissions so clustering logic is unified
  const preAssessedResults: ScoringResult[] = preAssessed.map((s) => ({
    submissionId: s.id,
    score: s.score ?? 0,
    scoreBand: s.score_band ?? 'low',
    memberMsg: s.member_msg ?? '',
    hAndSFlag: s.h_and_s_flag,
    aiSummary: s.ai_summary ?? '',
    aiNarrative: s.ai_narrative ?? '',
    costBand: s.cost_band ?? '',
    costEstimateLow: s.cost_estimate_low,
    costEstimateHigh: s.cost_estimate_high,
    costConfidence: (s.cost_confidence ?? 'low') as 'high' | 'medium' | 'low',
    costRationale: s.cost_rationale ?? '',
    implWeeksLow: s.impl_weeks_low,
    implWeeksHigh: s.impl_weeks_high,
    implComplexity: (s.impl_complexity ?? 'project') as 'quick_win' | 'project' | 'programme',
    strategicNote: s.strategic_note ?? '',
    suggestedOwner: s.suggested_owner,
    needsExternalApproval: s.needs_external_approval,
    approvalBody: s.approval_body,
    seasonalWindow: s.seasonal_window,
    revenueOpportunity: s.revenue_opportunity,
    revenueNote: s.revenue_note,
    clusterTheme: undefined,
    alreadyInPlan: false,
    memberNarrative: null,
    priorRejections: [],
  }))

  const results: ScoringResult[] = [...freshResults, ...preAssessedResults]

  const clusterMap = new Map<string, number>()
  // Track which submissions reused a pre-existing cluster (= recurring theme)
  const recurringClusterRunCounts = new Map<number, number>() // clusterId -> distinct prior run count

  for (const r of results) {
    let clusterId: number | null = null

    if (r.clusterTheme) {
      if (clusterMap.has(r.clusterTheme)) {
        // Already seen in this run
        clusterId = clusterMap.get(r.clusterTheme)!
        await sql`UPDATE clusters SET size = size + 1, updated_at = NOW() WHERE id = ${clusterId}`
      } else {
        // Check if this theme already exists from a previous run
        const existing = await sql`
          SELECT id FROM clusters WHERE LOWER(theme) = LOWER(${r.clusterTheme}) LIMIT 1
        `
        if (existing.length > 0) {
          // Reuse existing cluster — this is a recurring theme
          clusterId = (existing[0] as { id: number }).id
          await sql`UPDATE clusters SET size = size + 1, updated_at = NOW() WHERE id = ${clusterId}`
          clusterMap.set(r.clusterTheme, clusterId)
          // Count how many distinct prior triage runs used this cluster
          const priorRuns = await sql`
            SELECT COUNT(DISTINCT triage_run_id)::int AS cnt
            FROM submissions
            WHERE cluster_id = ${clusterId} AND triage_run_id IS NOT NULL
          `
          recurringClusterRunCounts.set(clusterId, (priorRuns[0] as { cnt: number }).cnt ?? 1)
        } else {
          // Brand-new cluster
          const clusterRows = await sql`INSERT INTO clusters (theme) VALUES (${r.clusterTheme}) RETURNING id`
          clusterId = (clusterRows[0] as { id: number }).id
          clusterMap.set(r.clusterTheme, clusterId)
        }
      }
    }

    let finalScore = r.score
    if (clusterId) {
      const clusterRow = await sql`SELECT size FROM clusters WHERE id = ${clusterId}`
      const size = (clusterRow[0] as { size: number })?.size ?? 1
      const bonusIdx = Math.min(size - 2, clusterBonuses.length - 1)
      const bonus = size >= 2 ? (clusterBonuses[bonusIdx] ?? 0) : 0
      finalScore = Math.min(10, finalScore + bonus)
    }

    const costThresholdCommittee = parseFloat(config['COST_THRESHOLD_COMMITTEE'] ?? '5000')
    const costThresholdQuickwin  = parseFloat(config['COST_THRESHOLD_QUICKWIN']  ?? '500')
    const implQuickwinWeeks      = parseFloat(config['IMPL_QUICKWIN_WEEKS']      ?? '4')

    const costMidpoint = r.costEstimateHigh != null && r.costEstimateLow != null
      ? (r.costEstimateLow + r.costEstimateHigh) / 2 : null

    const costThresholdFlag = costMidpoint != null && costMidpoint > costThresholdCommittee
    const quickWinFlag = (costMidpoint == null || costMidpoint <= costThresholdQuickwin)
      && (r.implWeeksHigh == null || r.implWeeksHigh <= implQuickwinWeeks)
      && r.implComplexity === 'quick_win'

    // If the AI scored this as a quick win, ensure the member message reflects that
    // regardless of the score band (avoids contradiction like "longer timeframe" + quick win badge)
    let memberMsg = r.memberNarrative || r.memberMsg
    if (quickWinFlag && !['priority', 'active'].includes(r.scoreBand)) {
      memberMsg = 'Your improvement has been identified as a potential quick win and may be actioned ahead of the standard review cycle.'
    }

    const suggestedTargetDate = r.implWeeksHigh != null
      ? new Date(Date.now() + r.implWeeksHigh * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : null

    // Recurring detection — did this cluster exist before this run?
    const recurringFlag = clusterId != null && recurringClusterRunCounts.has(clusterId)
    const recurringRunCount = recurringFlag ? (recurringClusterRunCounts.get(clusterId!) ?? 1) : 0

    await sql`
      UPDATE submissions SET
        score                   = ${finalScore},
        score_band              = ${r.scoreBand},
        member_msg              = ${memberMsg},
        h_and_s_flag            = ${r.hAndSFlag},
        cluster_id              = ${clusterId},
        ai_summary              = ${r.aiSummary},
        ai_narrative            = ${r.aiNarrative},
        cost_band               = ${r.costBand},
        cost_estimate_low       = ${r.costEstimateLow},
        cost_estimate_high      = ${r.costEstimateHigh},
        cost_confidence         = ${r.costConfidence},
        cost_rationale          = ${r.costRationale},
        impl_weeks_low          = ${r.implWeeksLow},
        impl_weeks_high         = ${r.implWeeksHigh},
        impl_complexity         = ${r.implComplexity},
        suggested_target_date   = ${suggestedTargetDate},
        cost_threshold_flag     = ${costThresholdFlag},
        quick_win_flag          = ${quickWinFlag},
        strategic_note          = ${r.strategicNote},
        needs_external_approval = ${r.needsExternalApproval},
        approval_body           = ${r.approvalBody},
        recurring_flag          = ${recurringFlag},
        recurring_run_count     = ${recurringRunCount},
        seasonal_window         = ${r.seasonalWindow},
        revenue_opportunity     = ${r.revenueOpportunity},
        revenue_note            = ${r.revenueNote},
        scored_at               = NOW(),
        status                  = CASE WHEN ${r.alreadyInPlan} THEN 'rejected' ELSE status END,
        related_submission_ids  = ${r.priorRejections.length > 0 ? JSON.stringify(r.priorRejections) : '{}'}::integer[]
      WHERE id = ${r.submissionId}
    `

    if (r.hAndSFlag) {
      const sub = unscored.find((s) => s.id === r.submissionId)
      if (sub) {
        try {
          await sendHAndSAlert({ id: sub.id, description: sub.description, category: sub.category, aiSummary: r.aiSummary })
        } catch (e) {
          console.error(`H&S alert email failed for submission ${r.submissionId}:`, e)
        }
      }
    }

    // High-score alert: score >= 9 — notify the relevant director immediately
    if (finalScore >= 9 && r.suggestedOwner) {
      const sub = unscored.find((s) => s.id === r.submissionId)
      if (sub) {
        try {
          // Find directors whose role matches suggestedOwner and have email_reports=true
          const alertDirs = await sql`
            SELECT email FROM director_roles
            WHERE role = ${r.suggestedOwner} AND active = TRUE AND email_reports = TRUE
          `
          for (const dir of alertDirs as Array<{ email: string }>) {
            await sendHighScoreAlert(dir.email, {
              id: sub.id,
              description: sub.description,
              category: sub.category,
              score: finalScore,
              aiSummary: r.aiSummary,
              suggestedOwner: r.suggestedOwner,
            })
          }
        } catch (e) {
          console.error(`High-score alert email failed for submission ${r.submissionId}:`, e)
        }
      }
    }

    const sub = unscored.find((s) => s.id === r.submissionId)

    // Skip member email if already sent at submission time (ai_assessed_at is set)
    if (!sub?.ai_assessed_at) {
      // Resolve submitter email — prefer the stored column, fall back to member_preferences
      let emailTo: string | null = sub?.member_email ?? null
      if (!emailTo && sub?.member_id) {
        console.log(`[triage] member_email null for submission ${r.submissionId}, looking up member_preferences for ${sub.member_id}`)
        const pref = await sql`SELECT email FROM member_preferences WHERE member_id = ${sub.member_id}`
        emailTo = (pref[0] as { email: string } | undefined)?.email ?? null
        if (emailTo) {
          console.log(`[triage] Found email in member_preferences: ${emailTo}`)
          await sql`UPDATE submissions SET member_email = ${emailTo} WHERE id = ${r.submissionId}`
        }
      }

      if (emailTo && !sub?.email_opt_out) {
        try {
          await sendSubmitterUpdate(emailTo, {
            id: sub!.id,
            description: sub!.description,
            scoreBand: r.scoreBand,
            memberMsg,
            costBand: r.costBand,
            implComplexity: r.implComplexity,
            suggestedTargetDate,
            quickWinFlag,
            memberName: sub!.member_name,
          })
        } catch (e) {
          console.error(`Submitter email failed for submission ${r.submissionId}:`, e)
        }
      } else {
        console.log(`[triage] No submitter email for submission ${r.submissionId}: emailTo=${emailTo}, opt_out=${sub?.email_opt_out}`)
      }
    } else {
      console.log(`[triage] Skipping member email for submission ${r.submissionId} — already sent at submission time`)
    }
  }

  const runRows = await sql`
    INSERT INTO triage_runs (period_start, period_end, next_run_at, submission_count, report_sent)
    VALUES (${periodStart.toISOString()}, ${periodEnd.toISOString()}, ${nextRunAt.toISOString()}, ${unscored.length}, FALSE)
    RETURNING id
  `
  const runId = (runRows[0] as { id: number }).id

  await sql`UPDATE submissions SET triage_run_id = ${runId} WHERE triage_run_id IS NULL AND scored_at IS NOT NULL`

  const scoredRows = await sql`
    SELECT s.*, c.theme AS cluster_theme, c.size AS cluster_size
    FROM submissions s
    LEFT JOIN clusters c ON c.id = s.cluster_id
    WHERE s.triage_run_id = ${runId}
    ORDER BY s.h_and_s_flag DESC, s.score DESC NULLS LAST
  `

  const directorEmails = await sql`SELECT role, email FROM director_roles WHERE active = TRUE AND email_reports = TRUE`

  for (const director of directorEmails as Array<{ role: string; email: string }>) {
    const allowedCats = DIRECTOR_CATEGORIES[director.role] ?? []
    const directorSubs = (scoredRows as Array<Record<string, unknown>>).filter(
      (s) => allowedCats.includes(s.category as string)
    )
    if (directorSubs.length === 0) continue
    try {
      const htmlReport = buildEmailReport(directorSubs)
      await sendTriageReport([director.email], periodStart, periodEnd, nextRunAt, htmlReport)
    } catch (e) {
      console.error(`Triage report email failed for ${director.email}:`, e)
    }
  }

  await sql`UPDATE triage_runs SET report_sent = TRUE WHERE id = ${runId}`

  return { scored: results.length, runId }
}

function buildEmailReport(submissions: Array<Record<string, unknown>>): string {
  const urgent = submissions.filter((s) => s.h_and_s_flag)
  const normal  = submissions.filter((s) => !s.h_and_s_flag)
  let html = ''
  if (urgent.length > 0) {
    html += `<h3 style="color:#c0392b;margin:24px 0 8px">⚠️ Health &amp; Safety — Requires Immediate Attention (${urgent.length})</h3>`
    html += urgent.map((s) => rowHtml(s, true)).join('')
  }
  html += `<h3 style="margin:24px 0 8px">Improvements (${normal.length})</h3>`
  html += normal.map((s) => rowHtml(s, false)).join('')
  return html
}

function rowHtml(s: Record<string, unknown>, isUrgent: boolean): string {
  const categoryLabel = CATEGORY_LABELS[s.category as string] ?? String(s.category)
  const statusLabel   = STATUS_LABELS[s.status as string]     ?? String(s.status ?? 'Received')
  const border        = isUrgent ? 'border:2px solid #c0392b' : 'border:1px solid #ddd'
  const statusColour  = isUrgent ? '#c0392b' : '#1a3a5c'
  const ref           = 'CIP-' + String(Number(s.id)).padStart(4, '0')

  return `
    <div style="${border};border-radius:8px;padding:14px;margin-bottom:10px;background:${isUrgent ? '#fff8f8' : '#fff'}">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">
        <span style="background:${statusColour};color:white;padding:2px 10px;border-radius:20px;font-size:12px;font-weight:600">${statusLabel}</span>
        <span style="color:#666;font-size:12px">${categoryLabel}</span>
        <span style="font-family:monospace;color:#aaa;font-size:11px">${ref}</span>
        ${s.cluster_theme ? `<span style="background:#2471a3;color:white;padding:2px 8px;border-radius:20px;font-size:11px">Cluster: ${s.cluster_theme}</span>` : ''}
        ${isUrgent ? `<span style="background:#c0392b;color:white;padding:2px 8px;border-radius:20px;font-size:11px">⚠️ H&amp;S</span>` : ''}
      </div>
      <p style="margin:0 0 6px;font-weight:600;color:#222">${s.ai_summary ?? s.description}</p>
      <p style="margin:0;color:#555;font-size:13px;line-height:1.5">${s.ai_narrative ?? ''}</p>
    </div>
  `
}
