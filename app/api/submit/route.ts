import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth'
import { sql } from '@/lib/db'
import { moderateSubmission, scoreBatch } from '@/lib/ai'
import { CATEGORIES } from '@/lib/categories'
import { sendModerationRejectionEmail, sendSubmissionConfirmation } from '@/lib/email'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('bci_session')?.value
  const session = token ? await verifySession(token) : null

  if (!session || (session.type !== 'member' && session.type !== 'director')) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Resolve submitter identity — works for both member and director sessions
  const submitterId   = session.type === 'member' ? session.memberId   : session.email
  const submitterName = session.type === 'member' ? session.memberName : session.directorName
  const submitterEmail = session.type === 'member' ? session.memberEmail : session.email

  const { description, benefit, category, impact, recognition, emailOptOut } = await req.json()

  if (!description?.trim() || !benefit?.trim() || !category || !impact || !recognition) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }

  const cat = CATEGORIES.find((c) => c.value === category)
  if (!cat) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }

  const validImpacts = [2, 4, 6, 8]
  if (!validImpacts.includes(Number(impact))) {
    return NextResponse.json({ error: 'Invalid impact value' }, { status: 400 })
  }

  // Fetch member's existing submissions for duplicate check
  const existing = await sql`
    SELECT description FROM submissions
    WHERE member_id = ${submitterId}
      AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 10
  `
  const existingDescriptions = (existing as Array<{ description: string }>).map((r) => r.description)

  const moderation = await moderateSubmission(description.trim(), benefit.trim(), existingDescriptions)

  if (!moderation.pass) {
    // Log silent rejects to DB so Manager can review them
    if (moderation.silentReject) {
      await sql`
        INSERT INTO submissions (member_id, member_name, description, benefit, category, impact, recognition, status, moderation_reason)
        VALUES (
          ${submitterId}, ${submitterName},
          ${description.trim()}, ${benefit.trim()},
          ${category}, ${Number(impact)}, ${recognition},
          'rejected', ${moderation.reason ?? 'silent_reject'}
        )
      `
    }
    // Send rejection email if they have an email
    if (submitterEmail && !emailOptOut) {
      void sendModerationRejectionEmail(submitterEmail, {
        description: description.trim(),
        message: moderation.message,
        memberName: submitterName,
      }).catch((e) => console.error('[submit] Moderation rejection email failed:', e))
    }
    return NextResponse.json({ ok: false, rejected: true, message: moderation.message })
  }

  const inserted = await sql`
    INSERT INTO submissions (member_id, member_name, description, benefit, category, impact, recognition, member_email, email_opt_out)
    VALUES (
      ${submitterId},
      ${submitterName},
      ${description.trim()},
      ${benefit.trim()},
      ${category},
      ${Number(impact)},
      ${recognition},
      ${submitterEmail ?? null},
      ${emailOptOut ? true : false}
    )
    RETURNING id
  `
  const submissionId = (inserted[0] as { id: number }).id

  // Run AI assessment immediately — store results and include memberMsg in confirmation email.
  // Clustering, director reports, and full triage happen overnight.
  let memberMsg: string | undefined
  try {
    const categoryCeiling = cat.ceiling ?? 10
    const [result] = await scoreBatch([{
      id: submissionId,
      description: description.trim(),
      benefit: benefit.trim(),
      category,
      impact: Number(impact),
      categoryCeiling,
    }])
    if (result) {
      memberMsg = result.memberNarrative || result.memberMsg
      const suggestedTargetDate = result.implWeeksHigh != null
        ? new Date(Date.now() + result.implWeeksHigh * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        : null
      await sql`
        UPDATE submissions SET
          score                   = ${result.score},
          score_band              = ${result.scoreBand},
          member_msg              = ${memberMsg},
          h_and_s_flag            = ${result.hAndSFlag},
          ai_summary              = ${result.aiSummary},
          ai_narrative            = ${result.aiNarrative},
          cost_band               = ${result.costBand},
          cost_estimate_low       = ${result.costEstimateLow},
          cost_estimate_high      = ${result.costEstimateHigh},
          cost_confidence         = ${result.costConfidence},
          cost_rationale          = ${result.costRationale},
          impl_weeks_low          = ${result.implWeeksLow},
          impl_weeks_high         = ${result.implWeeksHigh},
          impl_complexity         = ${result.implComplexity},
          suggested_target_date   = ${suggestedTargetDate},
          strategic_note          = ${result.strategicNote},
          suggested_owner         = ${result.suggestedOwner},
          needs_external_approval = ${result.needsExternalApproval},
          approval_body           = ${result.approvalBody},
          seasonal_window         = ${result.seasonalWindow},
          revenue_opportunity     = ${result.revenueOpportunity},
          revenue_note            = ${result.revenueNote},
          ai_assessed_at          = NOW()
        WHERE id = ${submissionId}
      `
    }
  } catch (e) {
    console.error('[submit] AI assessment failed — will be picked up by nightly triage:', e)
  }

  if (submitterEmail && !emailOptOut) {
    void sendSubmissionConfirmation(submitterEmail, description.trim(), submitterName)
      .catch((e) => console.error('[submit] Confirmation email failed:', e))
  }

  return NextResponse.json({
    ok: true,
    memberMsg: memberMsg ?? null,
  })
}
