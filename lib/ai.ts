import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export interface ModerationResult {
  pass: boolean
  reason?: 'profanity' | 'incoherent' | 'duplicate'
  message: string
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
    system: `You are a moderation gate for a golf club suggestion system.
Evaluate submissions against three criteria only. Respond with JSON only.`,
    messages: [{
      role: 'user',
      content: `Evaluate this suggestion submission.

SUGGESTION: ${description}
BENEFIT: ${benefit}

${duplicateContext}

Check for:
1. profanity - any offensive, abusive, or inappropriate language
2. incoherent - no actionable suggestion can be identified
3. duplicate - substantively the same as one of this member's previous submissions

Respond with exactly this JSON:
{
  "pass": true/false,
  "reason": null | "profanity" | "incoherent" | "duplicate"
}`,
    }],
  })

  const text = (response.content[0] as { text: string }).text.trim()
  const result = JSON.parse(text.replace(/```json|```/g, '').trim())

  if (result.pass) {
    return { pass: true, message: '' }
  }

  const messages: Record<string, string> = {
    profanity:  'We were unable to process your submission as it contains language that does not meet our community standards. Please resubmit.',
    incoherent: 'We were unable to identify a specific actionable suggestion. Please try again with a clearer description of what you\'d like to see improved.',
    duplicate:  'It looks like you\'ve already submitted a very similar suggestion. We\'ve recorded your original submission and it will be reviewed in our next assessment.',
  }

  return {
    pass: false,
    reason: result.reason,
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
      content: `Score these ${submissions.length} suggestion(s) and detect clusters among them.

${submissionsText}

Return a JSON array with one object per submission in the same order:
[
  {
    "submission_id": <id>,
    "weighted_score": <0-10 after multipliers, max 10.0>,
    "h_and_s_flag": true/false,
    "already_in_plan": true/false,
    "cluster_theme": "<shared theme string or null>",
    "ai_summary": "<one sentence summary of the suggestion>",
    "ai_narrative": "<2-3 sentence assessment for committee>",
    "cost_band": "negligible|low|medium|high|very_high",
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
      memberMsg = 'Your suggestion has been passed to the relevant director for consideration.'
    } else if (score >= weights.bandActive) {
      band = 'active'
      memberMsg = 'Your suggestion has been noted and will be reviewed at the next committee cycle.'
    } else if (score >= weights.bandHolding) {
      band = 'holding'
      memberMsg = 'Thank you — your suggestion has been recorded.'
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
    }
  })
}
