import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export interface ModerationResult {
  pass: boolean
  reason?: 'profanity' | 'incoherent' | 'duplicate' | 'political' | 'personal_attack' | 'out_of_scope'
  message: string
  silentReject?: boolean  // true = log but don't hint at reason
}

export async function moderateSubmission(
  description: string,
  benefit: string,
  existingMemberSubmissions: string[]
): Promise<ModerationResult> {
  const duplicateContext = existingMemberSubmissions.length > 0
    ? `The member has previously submitted: ${existingMemberSubmissions.map((s, i) => `[${i + 1}] ${s}`).join(' | ')}`
    : 'The member has no previous submissions.'

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    system: `You are a moderation gate for a private members golf club continuous improvement programme.
Your job is to protect the integrity of the programme. Evaluate submissions honestly and respond with JSON only.`,
    messages: [{
      role: 'user',
      content: `Evaluate this improvement submission from a club member.

IMPROVEMENT: ${description}
RATIONALE: ${benefit}

${duplicateContext}

Check for ALL of the following:
1. profanity — offensive, abusive, or inappropriate language
2. incoherent — no actionable improvement can be identified
3. duplicate — substantively the same as one of this member's previous submissions
4. political — targets specific individuals, committee members, staff, or other members by name or clear implication; constitutes a grievance or complaint rather than an improvement; is motivated by personal agenda rather than club benefit
5. personal_attack — criticism directed at a named or clearly identifiable individual
6. out_of_scope — has nothing to do with the golf club or its operations

Respond with exactly this JSON:
{
  "pass": true/false,
  "reason": null | "profanity" | "incoherent" | "duplicate" | "political" | "personal_attack" | "out_of_scope"
}`,
    }],
  })

  const text = (response.content[0] as { text: string }).text.trim()
  const result = JSON.parse(text.replace(/```json|```/g, '').trim())

  if (result.pass) {
    return { pass: true, message: '' }
  }

  // Political and personal attacks get a neutral message — don't signal the detection
  const silentReasons = ['political', 'personal_attack']
  const isSilent = silentReasons.includes(result.reason)

  const messages: Record<string, string> = {
    profanity:       'We were unable to process your submission as it contains language that does not meet our community standards. Please resubmit.',
    incoherent:      'We were unable to identify a specific actionable improvement. Please try again with a clearer description of what you\'d like to see improved.',
    duplicate:       'It looks like you\'ve already submitted a very similar improvement. We\'ve recorded your original submission and it will be reviewed at our next assessment.',
    political:       'Thank you for taking the time to submit. We\'re unable to progress this particular submission through the improvement programme. If you have a concern you\'d like to raise directly, please contact the Club Manager.',
    personal_attack: 'Thank you for taking the time to submit. We\'re unable to progress this particular submission through the improvement programme. If you have a concern you\'d like to raise directly, please contact the Club Manager.',
    out_of_scope:    'This submission doesn\'t appear to relate to Bramley Golf Club\'s operations. If you feel this is an error please resubmit with more context.',
  }

  return {
    pass: false,
    reason: result.reason,
    silentReject: isSilent,
    message: messages[result.reason] ?? 'We were unable to process your submission. Please try again.',
  }
}

export interface ScoringResult {
  submissionId: number
  score: number
  scoreBand: string
  memberMsg: string
  hAndSFlag: boolean
  clusterId?: number
  clusterTheme?: string
  aiSummary: string
  aiNarrative: string
  costBand: string
  strategicNote: string
  alreadyInPlan: boolean
  // Cost estimation
  costEstimateLow: number | null
  costEstimateHigh: number | null
  costConfidence: 'high' | 'medium' | 'low'
  costRationale: string
  // Implementation time
  implWeeksLow: number | null
  implWeeksHigh: number | null
  implComplexity: 'quick_win' | 'project' | 'programme'
}

export interface ScoringWeights {
  memberImpact: number
  strategic: number
  feasibility: number
  costBenefit: number
  novelty: number
  experienceDelta: number
  multHs: number
  multBudgetYear: number
  multMultiCategory: number
  bandPriority: number
  bandActive: number
  bandHolding: number
  bandLow: number
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  memberImpact: 0.25, strategic: 0.20, feasibility: 0.20,
  costBenefit: 0.15, novelty: 0.10, experienceDelta: 0.10,
  multHs: 1.5, multBudgetYear: 1.2, multMultiCategory: 1.1,
  bandPriority: 8.0, bandActive: 6.0, bandHolding: 4.0, bandLow: 2.0,
}

export async function scoreBatch(
  submissions: Array<{
    id: number
    description: string
    benefit: string
    category: string
    impact: number
    categoryCeiling: number
  }>,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): Promise<ScoringResult[]> {
  if (submissions.length === 0) return []

  const submissionsText = submissions.map((s, i) =>
    `[${i}] ID:${s.id} CATEGORY:${s.category} IMPACT_SCORE:${s.impact} CEILING:${s.categoryCeiling}
SUGGESTION: ${s.description}
BENEFIT: ${s.benefit}`
  ).join('\n\n')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: `You are a scoring engine for a golf club continuous improvement system at Bramley Golf Club.
Score each suggestion objectively. Never reveal scoring details to members. Return structured JSON only.

SCORING DIMENSIONS (weighted 0-10 per dimension, weights are configurable):
- member_impact (${Math.round(weights.memberImpact * 100)}%): Use the member's self-assessed impact score, capped at category ceiling, sense-check only (can reduce, not increase)
- strategic_alignment (${Math.round(weights.strategic * 100)}%): How well does it align with typical golf club strategic priorities
- feasibility (${Math.round(weights.feasibility * 100)}%): Realistic for a private members golf club to implement
- cost_benefit (${Math.round(weights.costBenefit * 100)}%): Likely cost band vs benefit delivered (cost bands: negligible/low/medium/high/very_high)
- novelty (${Math.round(weights.novelty * 100)}%): Not an obvious standard practice already in place
- member_experience_delta (${Math.round(weights.experienceDelta * 100)}%): Material improvement to day-to-day experience

MULTIPLIERS (applied after weighted score, cap final at 10.0):
- H&S flag: x${weights.multHs} (safety or compliance dimension)
- Budget year alignment: x${weights.multBudgetYear} (implementable in current financial year)
- Spans multiple categories: x${weights.multMultiCategory}

CLUSTER DETECTION:
Group semantically similar suggestions together. Assign a cluster_theme string for each group.
Suggestions that are not similar to any other suggestion get cluster_theme: null.

ALREADY IN PLAN:
If a suggestion describes something that any well-run golf club would already have in its standard strategic plan, set already_in_plan: true.`,
    messages: [{
      role: 'user',
      content: `Score these ${submissions.length} improvement(s), estimate costs and implementation time, and detect clusters.

${submissionsText}

COST ESTIMATION GUIDANCE (Bramley Golf Club scale — private members club, ~500-800 members):
- Estimate realistic £ costs for a UK private members golf club
- negligible: under £100 (staff time only, no materials)
- low: £100–£2,000
- medium: £2,000–£10,000
- high: £10,000–£50,000
- very_high: over £50,000
- Provide a low and high estimate as a realistic range
- confidence: high = well-defined, clearly scoped; medium = reasonable inference; low = very vague or dependent on unknowns

IMPLEMENTATION TIME GUIDANCE:
- quick_win: 1–4 weeks (minimal planning, existing resources)
- project: 1–6 months (planning required, possible procurement)
- programme: 6+ months (major works, planning permission, significant capital)

Return a JSON array with one object per improvement in the same order:
[
  {
    "submission_id": <id>,
    "weighted_score": <0-10 after multipliers, max 10.0>,
    "h_and_s_flag": true/false,
    "already_in_plan": true/false,
    "cluster_theme": "<shared theme string or null>",
    "ai_summary": "<one sentence summary>",
    "ai_narrative": "<2-3 sentence assessment for committee>",
    "cost_band": "negligible|low|medium|high|very_high",
    "cost_estimate_low": <number in £ or null if cannot estimate>,
    "cost_estimate_high": <number in £ or null if cannot estimate>,
    "cost_confidence": "high|medium|low",
    "cost_rationale": "<one sentence explaining the cost estimate>",
    "impl_weeks_low": <number or null>,
    "impl_weeks_high": <number or null>,
    "impl_complexity": "quick_win|project|programme",
    "strategic_note": "<one sentence on strategic alignment>"
  }
]`,
    }],
  })

  const text = (response.content[0] as { text: string }).text
  const raw: Array<{
    submission_id: number
    weighted_score: number
    h_and_s_flag: boolean
    already_in_plan: boolean
    cluster_theme: string | null
    ai_summary: string
    ai_narrative: string
    cost_band: string
    cost_estimate_low: number | null
    cost_estimate_high: number | null
    cost_confidence: 'high' | 'medium' | 'low'
    cost_rationale: string
    impl_weeks_low: number | null
    impl_weeks_high: number | null
    impl_complexity: 'quick_win' | 'project' | 'programme'
    strategic_note: string
  }> = JSON.parse(text.replace(/```json|```/g, '').trim())

  return raw.map((r) => {
    const score = Math.min(10, Math.max(0, r.weighted_score))
    let band = 'not_progressed'
    let memberMsg = 'Thank you — we welcome all feedback from our members.'

    if (r.already_in_plan) {
      band = 'in_plan'
      memberMsg = 'Great minds think alike — this area is already part of our plans. Thank you for the confirmation that it matters to you.'
    } else if (score >= weights.bandPriority) {
      band = 'priority'
      memberMsg = 'Your improvement has been passed to the relevant director for consideration.'
    } else if (score >= weights.bandActive) {
      band = 'active'
      memberMsg = 'Your improvement has been noted and will be reviewed at the next committee cycle.'
    } else if (score >= weights.bandHolding) {
      band = 'holding'
      memberMsg = 'Thank you — your improvement has been recorded.'
    } else if (score >= weights.bandLow) {
      band = 'low_priority'
      memberMsg = 'Thank you for taking the time to share your thoughts.'
    }

    return {
      submissionId: r.submission_id,
      score,
      scoreBand: band,
      memberMsg,
      hAndSFlag: r.h_and_s_flag,
      clusterTheme: r.cluster_theme ?? undefined,
      aiSummary: r.ai_summary,
      aiNarrative: r.ai_narrative,
      costBand: r.cost_band,
      strategicNote: r.strategic_note,
      alreadyInPlan: r.already_in_plan,
      costEstimateLow: r.cost_estimate_low ?? null,
      costEstimateHigh: r.cost_estimate_high ?? null,
      costConfidence: r.cost_confidence ?? 'low',
      costRationale: r.cost_rationale ?? '',
      implWeeksLow: r.impl_weeks_low ?? null,
      implWeeksHigh: r.impl_weeks_high ?? null,
      implComplexity: r.impl_complexity ?? 'project',
    }
  })
}
