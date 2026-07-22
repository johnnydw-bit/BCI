import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export interface ModerationResult {
  pass: boolean
  reason?: 'profanity' | 'incoherent' | 'duplicate' | 'political' | 'personal_attack' | 'out_of_scope' | 'complaint_only'
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
7. complaint_only — expresses dissatisfaction with NO implied action whatsoever. The bar here is deliberately low: if the club could reasonably infer ANY change to make (even a broad one like "renovate the kitchen", "improve car park lighting", "review the food menu"), it passes. Only reject if the submission is pure venting with zero implied improvement — e.g. "everything is terrible" or "the club is badly run". The triage scoring system will handle vague or low-specificity suggestions appropriately — moderation should not.

Respond with exactly this JSON:
{
  "pass": true/false,
  "reason": null | "profanity" | "incoherent" | "duplicate" | "political" | "personal_attack" | "out_of_scope" | "complaint_only"
}`,
    }],
  })

  const text = (response.content[0] as { text: string }).text.trim()
  let result: { pass: boolean; reason?: ModerationResult['reason'] }
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    result = JSON.parse(jsonMatch ? jsonMatch[0] : text.replace(/```json|```/g, '').trim())
  } catch (e) {
    console.error('[moderation] JSON parse failed, passing submission through. Raw text:', text, e)
    return { pass: true, message: '' }
  }

  if (result.pass) {
    return { pass: true, message: '' }
  }

  // Political and personal attacks get a neutral static message — don't signal the detection
  const silentReasons = ['political', 'personal_attack']
  const isSilent = silentReasons.includes(result.reason ?? '')

  const staticMessages: Record<string, string> = {
    political:       'Thank you for taking the time to submit. We\'re unable to progress this particular submission through the improvement programme. If you have a concern you\'d like to raise directly, please contact the Club Manager.',
    personal_attack: 'Thank you for taking the time to submit. We\'re unable to progress this particular submission through the improvement programme. If you have a concern you\'d like to raise directly, please contact the Club Manager.',
  }

  if (isSilent) {
    return {
      pass: false,
      reason: result.reason,
      silentReject: true,
      message: staticMessages[result.reason ?? ''],
    }
  }

  // For all other rejection reasons, generate a diplomatic, evidence-based AI response
  const message = await generateRejectionMessage(description, benefit, result.reason ?? '', existingMemberSubmissions)

  return {
    pass: false,
    reason: result.reason,
    silentReject: false,
    message,
  }
}

/**
 * Generate a diplomatic, evidence-based rejection message for a member
 * whose submission did not pass moderation.
 */
export async function generateRejectionMessage(
  description: string,
  benefit: string,
  reason: string,
  existingSubmissions: string[] = []
): Promise<string> {
  const reasonGuidance: Record<string, string> = {
    profanity:      'The submission contains language that does not meet the club\'s community standards. Acknowledge this diplomatically without being preachy, and invite a resubmission with the same idea expressed respectfully.',
    incoherent:     'The submission does not contain a clear, actionable improvement that the club could act on. Explain specifically what is missing — a concrete proposed change — and invite resubmission with more detail.',
    duplicate:      `The submission is substantially the same as a previous submission from this member: "${existingSubmissions[0] ?? 'a prior submission'}". Acknowledge that the member clearly cares about this issue, confirm their original submission is already in the system and will be reviewed, and reassure them it has not been overlooked.`,
    out_of_scope:   'The submission does not relate to Bramley Golf Club\'s operations or facilities. Politely explain that the programme is for improvements to the club\'s own services, and invite resubmission if they have a golf club related idea.',
    complaint_only: 'The submission expresses dissatisfaction but does not propose a specific change the club could act on. Acknowledge the underlying concern, explain what a valid submission looks like (a concrete proposed improvement), and encourage resubmission with a specific suggestion.',
  }

  const guidance = reasonGuidance[reason] ?? 'The submission could not be progressed. Politely explain this and invite resubmission if appropriate.'

  const fallbacks: Record<string, string> = {
    profanity:      'We were unable to process your submission as it contains language that does not meet our community standards. Please resubmit.',
    incoherent:     'We were unable to identify a specific actionable improvement. Please try again with a clearer description of what you\'d like to see changed.',
    duplicate:      'It looks like you\'ve already submitted a very similar improvement. We\'ve recorded your original submission and it will be reviewed at our next assessment.',
    out_of_scope:   'This submission doesn\'t appear to relate to Bramley Golf Club\'s operations. If you feel this is an error please resubmit with more context.',
    complaint_only: 'To progress through the improvement programme, submissions need to suggest a specific change rather than express general dissatisfaction. Please resubmit describing what you would like the club to do differently.',
  }

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: `You write short, diplomatic member communications for Bramley Golf Club's Continuous Improvement Programme.
Tone: warm, respectful, and constructive — like a thoughtful club secretary. Never condescending or preachy.
Reference specific details from what the member actually wrote so they feel genuinely heard.
Always refer to the governing body as "the Board" — never "the committee".
Keep to 3–5 sentences. Output plain text only — no bullet points, no markdown, no subject line.`,
      messages: [{
        role: 'user',
        content: `A member submitted the following improvement idea, which we are unable to progress:

IMPROVEMENT: ${description}
RATIONALE: ${benefit}

Reason it cannot be progressed: ${guidance}

Write a diplomatic, evidence-based response to this member. Reference their specific idea so they know it was read. Be constructive and, where appropriate, invite resubmission.`,
      }],
    })

    return (response.content[0] as { text: string }).text.trim()
  } catch (e) {
    console.error('[rejection] AI message generation failed, using fallback:', e)
    return fallbacks[reason] ?? 'We were unable to process your submission. Please try again.'
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
  // Extended flags
  suggestedOwner: string | null
  needsExternalApproval: boolean
  approvalBody: string | null
  seasonalWindow: string | null
  revenueOpportunity: boolean
  revenueNote: string | null
  memberNarrative: string | null
  priorRejections: number[]
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

/**
 * Generate a personalised status-change email body for a member.
 * For "rejected" status, pass aiNarrative and directorNote as private context
 * to produce a diplomatic, evidence-based explanation — neither is quoted verbatim.
 */
export async function generateFinalApprovalEmail(opts: {
  description: string
  tone: 'friendly' | 'formal'
  signoff: string
  clubManagerName: string
}): Promise<string> {
  const { description, tone, signoff, clubManagerName } = opts
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: `You write short, ${tone} member emails for Bramley Golf Club's Continuous Improvement Programme.
Tone: ${tone === 'friendly' ? 'warm and positive — this is good news worth celebrating briefly' : 'professional and congratulatory'}.
Keep to 2-3 sentences. Never mention scoring, internal processes, or staff names other than the Club Manager. Never include a subject line. Do not start with "Dear Member" — just write the body paragraph(s).
Always refer to the governing body as "the Board" — never "the committee".
Sign off as: ${signoff}`,
    messages: [{
      role: 'user',
      content: `Write a short email to a member confirming that their improvement idea ("${description}") has been fully approved and signed off at Board level. This is the final confirmation — all required approvals are now in place. The email is sent on behalf of the Club Manager, ${clubManagerName}. End with the sign-off "${signoff}". Output plain text only — no HTML, no markdown.`,
    }],
  })
  return (response.content[0] as { text: string }).text.trim()
}

export async function generateStatusEmail(opts: {
  description: string
  benefit?: string
  newStatus: string
  statusLabel: string
  confirmedTargetDate: string | null
  tone: 'friendly' | 'formal'
  signoff: string
  aiNarrative?: string | null
  directorNote?: string | null
}): Promise<string> {
  const { description, benefit, statusLabel, confirmedTargetDate, tone, signoff, newStatus, aiNarrative, directorNote } = opts
  const dateNote = confirmedTargetDate
    ? `The Board's target date for this is ${new Date(confirmedTargetDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`
    : ''

  const isRejection = newStatus === 'rejected'

  const systemPrompt = isRejection
    ? `You write diplomatic, evidence-based member emails for Bramley Golf Club's Continuous Improvement Programme.
Tone: ${tone === 'friendly' ? 'warm and respectful — like a thoughtful club secretary' : 'professional and courteous — like an official club communication'}.
Your task is to inform a member that their improvement idea will not be progressed, in a way that:
- Genuinely acknowledges the idea and shows it was properly considered
- Gives a real, specific reason grounded in the nature of the idea (not a vague brush-off)
- Is honest but diplomatic — never dismissive or condescending
- Invites continued engagement with the programme
Keep to 4-6 sentences. Never mention scoring, score bands, internal process, or staff names. Never include a subject line. Do not start with "Dear Member". Always refer to the governing body as "the Board" — never "the committee". Sign off as: ${signoff}`
    : `You write honest, balanced member emails for Bramley Golf Club's Continuous Improvement Programme.
Tone: ${tone === 'friendly' ? 'warm but measured — like a thoughtful club secretary who is being straight with a member' : 'professional and candid — like an official club communication that respects the member\'s intelligence'}.
Keep to 2-4 sentences. Never mention scoring, internal processes, or staff names. Never include a subject line. Do not start with "Dear Member" — just write the body paragraph(s).
Always refer to the governing body as "the Board" — never "the committee".
Do NOT be unconditionally optimistic. If there are caveats, complexities, or conditions attached to the decision, reflect them honestly. A realistic tone is more credible than a cheerful one.
Sign off as: ${signoff}`

  const userContent = isRejection
    ? `Write an email to a member informing them that their improvement idea will not be progressed by the Board.

MEMBER'S IDEA: "${description}"
MEMBER'S STATED BENEFIT: "${benefit ?? ''}"

INTERNAL CONTEXT (do NOT quote verbatim or reference directly — use only if it adds useful member-facing colour):
AI assessment: ${aiNarrative ?? 'Not available.'}
${directorNote ? `Board note: ${directorNote}` : ''}

Write a diplomatic, evidence-based email that references specific aspects of their idea to show it was genuinely considered. Give a real reason why it cannot be progressed at this time — draw on the internal context where helpful, but express it in plain member-facing language. Do not mention the AI, scoring, or any internal system. End with the sign-off "${signoff}". Output plain text only — no HTML, no markdown.`
    : `Write the email body to send to the member whose improvement idea ("${description}") has moved to status: "${statusLabel}". ${dateNote}

INTERNAL CONTEXT (never quote or reference directly — use to inform tone and content only):
AI assessment: ${aiNarrative ?? 'Not available.'}
${directorNote ? `Board note: "${directorNote}"

IMPORTANT: If the Board note contains caveats, conditions, timelines, budget concerns, or complexity warnings, these MUST be reflected honestly in the email. Do not write an unconditionally positive message if the note signals reservations.` : ''}

The tone is ${tone}. End with the sign-off "${signoff}". Output plain text only — no HTML, no markdown.`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: isRejection ? 500 : 400,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: userContent,
    }],
  })

  return (response.content[0] as { text: string }).text.trim()
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
  weights: ScoringWeights = DEFAULT_WEIGHTS,
  priorRejected: Array<{ id: number; description: string; category: string; rejected_at: string }> = []
): Promise<ScoringResult[]> {
  if (submissions.length === 0) return []

  const submissionsText = submissions.map((s, i) =>
    `[${i}] ID:${s.id} CATEGORY:${s.category} IMPACT_SCORE:${s.impact} CEILING:${s.categoryCeiling}
SUGGESTION: ${s.description}
BENEFIT: ${s.benefit}`
  ).join('\n\n')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system: `You are a scoring engine for a golf club continuous improvement system at Bramley Golf Club.
Score each suggestion objectively. Never reveal scoring details to members. Return structured JSON only.

SCORING DIMENSIONS (weighted 0-10 per dimension, weights are configurable):
- member_impact (${Math.round(weights.memberImpact * 100)}%): Start from the member's self-assessed impact score, capped at category ceiling. You MAY adjust up or down by up to 2 points: reduce for vague/directional suggestions that cannot be acted on without further data; increase for ideas with clear, immediate benefit the member may have underestimated.
- strategic_alignment (${Math.round(weights.strategic * 100)}%): How well does it align with typical golf club strategic priorities
- feasibility (${Math.round(weights.feasibility * 100)}%): Realistic for a private members golf club to implement. Score HIGH (8-10) for ideas that require no capital spend, no external approval, and can be done within days by existing staff. Score LOW for ideas that require planning permission, major procurement, or are operationally impractical.
- cost_benefit (${Math.round(weights.costBenefit * 100)}%): Likely cost band vs benefit delivered (cost bands: negligible/low/medium/high/very_high). A zero-cost quick-win should score 9-10 here.
- novelty (${Math.round(weights.novelty * 100)}%): Not an obvious standard practice already in place
- member_experience_delta (${Math.round(weights.experienceDelta * 100)}%): Material improvement to day-to-day experience

IMPORTANT — vague suggestions: If a suggestion is directional rather than specific (e.g. "reduce competitions" without data or a concrete proposal), treat it as low-actionability: reduce member_impact by 1-2 points and note this in the ai_narrative. The Board cannot act on direction alone.

MULTIPLIERS (applied after weighted score, cap final at 10.0):
- H&S flag: x${weights.multHs} — set h_and_s_flag: true ONLY for genuine, active Health & Safety risks: trip/slip hazards, structural or electrical safety, fire safety, food hygiene violations, or immediate danger to members or staff if left unaddressed. Do NOT flag improvements that merely mention "safety" in passing, have incidental safety benefits, or represent good practice without an existing risk. Ask yourself: would a reasonable person consider this a reportable H&S concern if nothing were done?
- Budget year alignment: x${weights.multBudgetYear} (implementable in current financial year)
- Spans multiple categories: x${weights.multMultiCategory}

CLUSTER DETECTION:
Cluster suggestions only when they describe the SAME specific problem or improvement area — not merely the same broad theme.
Examples of valid clusters: two suggestions both asking for better bunker raking; three suggestions about slow food service in the restaurant.
Examples of invalid clusters: a shower request and a locker room request (both facilities but different problems); a chef complaint and a sauna request (both experience but entirely different issues).
Assign a cluster_theme string (specific, e.g. "Shower facilities in changing rooms") only when genuinely the same issue.
Suggestions that are not a strong match with any other suggestion get cluster_theme: null.
When in doubt, do NOT cluster — false negatives are better than false positives.

ALREADY IN PLAN:
If a suggestion describes something that any well-run golf club would already have in its standard strategic plan, set already_in_plan: true.

SUGGESTED OWNER:
Always return the single most appropriate role to own this improvement (never null):
- "Golf Director" — course conditions, competition formats, handicaps, tee times
- "Estate Director" — buildings, grounds, car park, maintenance, capital works
- "F&B Director" — bar, restaurant, halfway house, on-course refreshments
- "Commercial Director" — pro shop, visitor revenue, external partnerships, marketing
- "Operations Manager" — day-to-day operations, staff scheduling, member services, facilities management, issues that span departments
- "Club Manager" — member communications, governance, policies, strategic or cross-cutting issues requiring senior sign-off

EXTERNAL APPROVAL:
Set needs_external_approval: true if implementation would require sign-off from any external body.
Common triggers: planning permission (structures, significant landscaping), local licensing authority (alcohol, entertainment), England Golf or county union (competition formats, course ratings), HSE (structural safety), Environment Agency (drainage, chemicals, protected species), insurance underwriters (liability changes).
If true, name the specific body in approval_body (e.g. "Planning permission required from local authority", "England Golf handicapping committee approval").
If no external approval is needed, return false and null.

SEASONAL WINDOW:
If implementation is constrained to a specific time of year, describe it concisely in seasonal_window.
Examples: "Winter only — course closure preferred Oct–Mar", "Pre-season — ideally February before main season", "Summer — dry ground required for groundworks".
Return null if there is no meaningful seasonal constraint.

REVENUE OPPORTUNITY:
Set revenue_opportunity: true only if successful implementation could actively generate new income for the club — not merely save costs.
In revenue_note, briefly explain the income mechanism (e.g. "Pay-and-play visitors attracted by improved facilities", "Premium pricing opportunity for enhanced locker experience").
Return false and null if there is no direct revenue upside.`,
    messages: [{
      role: 'user',
      content: `Score these ${submissions.length} improvement(s), estimate costs and implementation time, detect clusters, and check for similarity to previously not-progressed submissions.

${submissionsText}

${priorRejected.length > 0 ? `PREVIOUSLY NOT-PROGRESSED SUBMISSIONS (for reference — check each new submission against these):
${priorRejected.map(p => `[PRIOR:${p.id}] ${new Date(p.rejected_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })} | ${p.category} | ${p.description}`).join('\n')}

For each new submission, identify any prior submissions that are substantially the same improvement idea (same specific ask, not just same broad area). Only match when the core request is essentially identical — not merely related. Return matched prior IDs in prior_rejections. If a match exists, reference it naturally in ai_narrative: e.g. "A similar proposal (CIP-XXXX) was not progressed in [month/year] — the Board may wish to consider whether circumstances have changed." Do not mention prior submissions if prior_rejections is empty.` : ''}

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
    "ai_narrative": "<2-3 sentence assessment for the Board>",
    "cost_band": "negligible|low|medium|high|very_high",
    "cost_estimate_low": <number in £ or null if cannot estimate>,
    "cost_estimate_high": <number in £ or null if cannot estimate>,
    "cost_confidence": "high|medium|low",
    "cost_rationale": "<one sentence explaining the cost estimate>",
    "impl_weeks_low": <number or null>,
    "impl_weeks_high": <number or null>,
    "impl_complexity": "quick_win|project|programme",
    "strategic_note": "<one sentence on strategic alignment>",
    "suggested_owner": "<role title>",
    "needs_external_approval": true/false,
    "approval_body": "<description or null>",
    "seasonal_window": "<description or null>",
    "revenue_opportunity": true/false,
    "revenue_note": "<brief explanation or null>",
    "prior_rejections": [<array of matching PRIOR submission IDs, empty array if none>],
    "member_narrative": "<A short personalised response written directly to the member in plain, measured English — structured as follows (use exactly these labels and a blank line between sections):\n\nOpening: one sentence acknowledging that the submission has been received and will be considered. Do NOT say the idea is great, exciting, or that it will be taken forward.\n\nPros:\n• [genuine strength 1]\n• [genuine strength 2 if applicable]\n\nThings to consider:\n• [challenge or constraint 1]\n• [challenge or constraint 2 if applicable]\n\nClosing: one sentence making clear this is an initial assessment only, that the Board reviews all submissions alongside other priorities, and that not every idea will be progressed.\n\nRules: CRITICAL — do not use language that implies the idea will be implemented, actioned, or progressed. Phrases like 'this could be a great addition', 'we look forward to taking this forward', 'this is exactly the kind of idea we need' are FORBIDDEN. The tone must be neutral and informative, not encouraging or enthusiastic. Never mention scores, bands, ceilings, multipliers, weights, or internal process. Never reference the member's self-assessed impact score or any scoring dimension. Always refer to the governing body as 'the Board' — never 'the committee'. Write as if a thoughtful club official is giving a balanced, honest assessment. Keep bullet points concise — one line each.\n\nFOOD & BEVERAGE RULE: If the submission category is restaurant, bar, or refreshments, the 'Things to consider' section MUST address all three of the following where relevant — volume (whether demand is sufficient to justify the change), profitability (margin and pricing implications), and wastage (food waste, over-ordering, or spoilage risk). These are the key operational realities the club must weigh for any F&B change.>"
  }
]`,
    }],
  })

  const text = (response.content[0] as { text: string }).text
  let raw: Array<{
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
    suggested_owner: string | null
    needs_external_approval: boolean
    approval_body: string | null
    seasonal_window: string | null
    revenue_opportunity: boolean
    revenue_note: string | null
    prior_rejections: number[]
    member_narrative: string | null
  }>
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    raw = JSON.parse(jsonMatch ? jsonMatch[0] : text.replace(/```json|```/g, '').trim())
  } catch (e) {
    console.error('[scoring] JSON parse failed. Raw text:', text, e)
    throw new Error('AI scoring response could not be parsed')
  }

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
      memberMsg = 'Your improvement has been noted and will be reviewed at the next Board cycle.'
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
      suggestedOwner: r.suggested_owner ?? null,
      needsExternalApproval: r.needs_external_approval ?? false,
      approvalBody: r.approval_body ?? null,
      seasonalWindow: r.seasonal_window ?? null,
      revenueOpportunity: r.revenue_opportunity ?? false,
      revenueNote: r.revenue_note ?? null,
      memberNarrative: r.member_narrative ?? null,
      priorRejections: r.prior_rejections ?? [],
    }
  })
}
