import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth'
import { sql } from '@/lib/db'
import { DIRECTOR_CATEGORIES, getCategoriesForRole, isManager, roleToAuthority, canOverrideAuthority, AUTHORITY_LEVELS, DEFAULT_SPEND_LIMITS, isDecisionFinalised } from '@/lib/categories'
import { generateStatusEmail } from '@/lib/ai'
import { sendStatusChangeEmail, sendRatificationNotification, sendOwnerAssignmentNotification } from '@/lib/email'

/** Load spend limits from the config table, falling back to defaults */
async function loadSpendLimits(): Promise<Record<string, number>> {
  const rows = await sql`
    SELECT key, value FROM config
    WHERE key IN ('SPEND_LIMIT_DIRECTOR','SPEND_LIMIT_OPERATIONS_MANAGER','SPEND_LIMIT_CLUB_MANAGER','SPEND_LIMIT_CHAIRMAN')
  `
  const map: Record<string, number> = { ...DEFAULT_SPEND_LIMITS }
  for (const r of rows as Array<{ key: string; value: string }>) {
    if (r.key === 'SPEND_LIMIT_DIRECTOR')           map.director            = Number(r.value)
    if (r.key === 'SPEND_LIMIT_OPERATIONS_MANAGER') map.operations_manager  = Number(r.value)
    if (r.key === 'SPEND_LIMIT_CLUB_MANAGER')       map.club_manager        = Number(r.value)
    if (r.key === 'SPEND_LIMIT_CHAIRMAN')           map.chairman            = Number(r.value)
  }
  return map
}

const STATUS_LABELS: Record<string, string> = {
  new:                 'Awaiting Decision',
  under_consideration: 'Under Consideration',
  approved:            'Approved',
  implemented:         'Implemented',
  rejected:            'Not Progressed',
  in_plan:             'In Plan',
}

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('bci_director_session')?.value
  const session = token ? await verifySession(token) : null

  if (!session || session.type !== 'director') {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
  }

  const allowedCategories = getCategoriesForRole(session.role)

  const rows = await sql`
    SELECT
      s.id, s.description, s.benefit, s.category, s.impact,
      s.status, s.score, s.score_band, s.h_and_s_flag,
      s.cluster_id, s.ai_summary, s.ai_narrative,
      s.cost_band, s.cost_estimate_low, s.cost_estimate_high,
      s.cost_confidence, s.cost_rationale, s.cost_threshold_flag, s.quick_win_flag,
      s.impl_weeks_low, s.impl_weeks_high, s.impl_complexity, s.suggested_target_date,
      s.confirmed_target_date,
      s.strategic_note, s.member_msg,
      s.recognition, s.member_name, s.created_at, s.scored_at,
      s.moderation_reason,
      s.suggested_owner, s.needs_external_approval, s.approval_body,
      s.recurring_flag, s.recurring_run_count,
      s.seasonal_window, s.revenue_opportunity, s.revenue_note,
      s.notes, s.score_override, s.score_override_reason, s.score_override_by,
      s.confirmed_cost, s.decision_authority, s.decision_by,
      c.theme AS cluster_theme, c.size AS cluster_size,
      (d.email IS NOT NULL) AS from_board
    FROM submissions s
    LEFT JOIN clusters c ON c.id = s.cluster_id
    LEFT JOIN director_roles d ON d.email = s.member_email AND d.active = TRUE
    WHERE s.category = ANY(${allowedCategories})
      AND s.deleted_at IS NULL
      AND s.withdrawn_at IS NULL
    ORDER BY s.h_and_s_flag DESC, s.score DESC NULLS LAST, s.created_at DESC
  `

  const spendLimits = await loadSpendLimits()

  return NextResponse.json({
    role: session.role,
    directorName: session.directorName,
    submissions: rows,
    isManager: isManager(session.role),
    spendLimits,
  })
}

export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('bci_director_session')?.value
  const session = token ? await verifySession(token) : null

  if (!session || session.type !== 'director') {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
  }

  const {
    id, status, category, suggested_owner, notes,
    score_override, score_override_reason,
    confirmed_target_date, confirmed_cost,
    return_email_draft,
  } = await req.json()

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // Fetch current decision authority and confirmed cost to enforce hierarchy + spend limits
  const currentRow = await sql`SELECT decision_authority, confirmed_cost FROM submissions WHERE id = ${id}`
  const currentAuthority = (currentRow[0] as { decision_authority: string | null })?.decision_authority ?? null
  const existingConfirmedCost = (currentRow[0] as { confirmed_cost: number | null })?.confirmed_cost ?? null

  // Decision fields require authority check — score override still requires isManager
  const myAuthority = roleToAuthority(session.role)
  const hasDecisionAccess = canOverrideAuthority(session.role, currentAuthority)

  // Load spend limits from config
  const spendLimits = await loadSpendLimits()

  if ((status !== undefined || suggested_owner !== undefined || notes !== undefined ||
       confirmed_target_date !== undefined || confirmed_cost !== undefined || category !== undefined) &&
      !hasDecisionAccess) {
    return NextResponse.json({ error: 'This decision has been ratified by a higher authority and cannot be changed.' }, { status: 403 })
  }

  if (suggested_owner !== undefined) {
    await sql`UPDATE submissions SET suggested_owner = ${suggested_owner || null} WHERE id = ${id}`
    if (suggested_owner) {
      try {
        const subRow = await sql`SELECT description FROM submissions WHERE id = ${id}`
        const description = (subRow[0] as { description: string })?.description ?? ''
        const ownerDirectors = await sql`
          SELECT email FROM director_roles
          WHERE role = ${suggested_owner} AND active = TRUE AND email IS NOT NULL
        `
        const ownerEmails = (ownerDirectors as Array<{ email: string }>).map((r) => r.email)
        const resendId = await sendOwnerAssignmentNotification(ownerEmails, {
          description,
          assignedRole: suggested_owner,
          assignedBy: session.directorName,
          submissionId: id,
        })
        await sql`
          INSERT INTO notification_log (submission_id, type, recipients, resend_id)
          VALUES (${id}, 'owner_assigned', ${ownerEmails.join(', ')}, ${resendId ?? null})
        `
      } catch (e) {
        console.error('[triage PATCH] Failed to send owner assignment notification:', e)
      }
    }
  }

  if (notes !== undefined) {
    await sql`UPDATE submissions SET notes = ${notes || null} WHERE id = ${id}`
  }

  if (confirmed_target_date !== undefined) {
    await sql`UPDATE submissions SET confirmed_target_date = ${confirmed_target_date || null} WHERE id = ${id}`
  }

  if (confirmed_cost !== undefined) {
    const costVal = confirmed_cost !== '' && confirmed_cost !== null ? Math.round(Number(confirmed_cost)) : null
    await sql`UPDATE submissions SET confirmed_cost = ${costVal} WHERE id = ${id}`
  }

  if (score_override !== undefined) {
    const overrideVal = score_override !== null ? Math.min(10, Math.max(0, Number(score_override))) : null
    await sql`
      UPDATE submissions
      SET score_override = ${overrideVal},
          score_override_reason = ${score_override_reason || null},
          score_override_by = ${overrideVal !== null ? session.directorName : null}
      WHERE id = ${id}
    `
    if (overrideVal !== null) {
      await sql`
        INSERT INTO status_log (submission_id, old_status, new_status, changed_by, note)
        SELECT id, status, status, ${session.directorName}, ${'Score overridden to ' + overrideVal + ': ' + (score_override_reason ?? '')}
        FROM submissions WHERE id = ${id}
      `
    }
  }

  if (status) {
    const validStatuses = ['new', 'under_consideration', 'approved', 'implemented', 'rejected', 'in_plan']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const current = await sql`
      SELECT status, description, benefit, member_email, member_name, email_opt_out,
             confirmed_target_date, ai_narrative, notes, category
      FROM submissions WHERE id = ${id}
    `
    const row = current[0] as {
      status: string
      description: string
      benefit: string | null
      member_email: string | null
      member_name: string | null
      email_opt_out: boolean
      confirmed_target_date: string | null
      ai_narrative: string | null
      notes: string | null
      category: string | null
    }
    const oldStatus = row?.status

    // Determine the effective cost for finality check:
    // use the incoming confirmed_cost if being set now, otherwise the existing value
    const effectiveCost = confirmed_cost !== undefined
      ? (confirmed_cost !== '' && confirmed_cost !== null ? Math.round(Number(confirmed_cost)) : null)
      : existingConfirmedCost
    const finalised = isDecisionFinalised(myAuthority, effectiveCost, spendLimits)

    await sql`
      UPDATE submissions
      SET status = ${status},
          confirmed_target_date = COALESCE(${confirmed_target_date || null}, confirmed_target_date),
          decision_authority = ${myAuthority},
          decision_by = ${session.directorName}
      WHERE id = ${id}
    `
    const spendNote = !finalised && effectiveCost !== null
      ? ` (cost £${effectiveCost.toLocaleString()} exceeds signoff limit — pending ratification)`
      : ''
    if (status !== oldStatus) await sql`
      INSERT INTO status_log (submission_id, old_status, new_status, changed_by, note)
      VALUES (${id}, ${oldStatus}, ${status}, ${session.directorName}, ${spendNote || null})
    `

    // Generate and send (or return as draft) AI email to member
    let emailDraft: { to: string; subject: string; body: string; memberName: string | null; description: string; statusLabel: string } | null = null
    if (row?.member_email && !row.email_opt_out) {
      try {
        const configRows = await sql`SELECT key, value FROM config WHERE key IN ('COMMS_TONE', 'COMMS_SIGNOFF')`
        const cfg = Object.fromEntries((configRows as Array<{ key: string; value: string }>).map((r) => [r.key, r.value]))
        const tone = (cfg['COMMS_TONE'] ?? 'friendly') as 'friendly' | 'formal'
        const signoff = cfg['COMMS_SIGNOFF'] ?? 'The Board, Bramley Golf Club'
        const targetDate = finalised ? (confirmed_target_date ?? row.confirmed_target_date ?? null) : null

        const emailBody = await generateStatusEmail({
          description: row.description,
          benefit: row.benefit ?? undefined,
          newStatus: status,
          statusLabel: STATUS_LABELS[status] ?? status,
          confirmedTargetDate: targetDate,
          tone,
          signoff,
          aiNarrative: row.ai_narrative ?? null,
          directorNote: row.notes ?? null,
        })

        if (return_email_draft) {
          const cipRefStr = 'CIP-' + String(id).padStart(4, '0')
          emailDraft = {
            to: row.member_email!,
            subject: `Update on your Bramley GC improvement idea [${cipRefStr}]`,
            body: emailBody,
            memberName: row.member_name,
            description: row.description,
            statusLabel: STATUS_LABELS[status] ?? status,
          }
        } else {
          await sendStatusChangeEmail(row.member_email!, {
            description: row.description,
            statusLabel: STATUS_LABELS[status] ?? status,
            emailBody,
            memberName: row.member_name,
            submissionId: id,
          })
        }
      } catch (e) {
        console.error('[triage PATCH] Failed to generate/send status change email:', e)
      }
    }

    // Send ratification chain notification — next ratifier + category directors
    try {
      const ROLE_AUTHORITY_MAP: Record<string, string> = {
        'Operations Manager': 'operations_manager',
        'Club Manager':       'club_manager',
        'Super Admin':        'club_manager',
        'Chair of the Board': 'chairman',
      }
      const AUTHORITY_LEVEL: Record<string, number> = {
        director: 1, operations_manager: 2, club_manager: 3, chairman: 4,
      }

      const NEXT_RATIFIER: Record<string, string | null> = {
        director:            'Operations Manager',
        operations_manager:  'Club Manager',
        club_manager:        'Chair of the Board',
        chairman:            null,
      }
      // If finalised by spend limit, no further ratification needed regardless of chain position
      const nextRatifier = finalised ? null : (NEXT_RATIFIER[myAuthority] ?? null)

      // When pending: notify up to and including the next ratifier level.
      // When finalised: notify all senior roles (decision announcement).
      const nextRatifierLevel = nextRatifier
        ? (AUTHORITY_LEVEL[ROLE_AUTHORITY_MAP[nextRatifier] ?? ''] ?? 99)
        : 99 // finalised — include everyone

      const allRows = await sql`
        SELECT name, email, role FROM director_roles
        WHERE active = TRUE AND email IS NOT NULL
      `
      const categoryForSubmission = row.category ?? null
      const allPeople = allRows as Array<{ name: string; email: string; role: string }>

      // Primary recipients (TO): only those whose role matches the next ratifier title
      // (or all senior roles up to the top when finalised — decision announcement)
      const toRecipients = allPeople
        .filter(r => {
          if (r.email === session.email) return false
          const authority = ROLE_AUTHORITY_MAP[r.role]
          if (!authority) return false
          const level = AUTHORITY_LEVEL[authority] ?? 99
          if (nextRatifier) {
            // Send to only the next ratifier level
            return level === (AUTHORITY_LEVEL[ROLE_AUTHORITY_MAP[nextRatifier] ?? ''] ?? -1)
          }
          // Finalised: send TO all senior roles (announcement)
          return level <= nextRatifierLevel
        })
        .map(r => r.email)

      // CC: category directors for this submission (for awareness; no action needed)
      const ccRecipients = allPeople
        .filter(r => {
          if (r.email === session.email) return false
          if (toRecipients.includes(r.email)) return false // don't double-up
          const authority = ROLE_AUTHORITY_MAP[r.role]
          if (authority) return false // senior roles are handled in TO
          const theirCategories = getCategoriesForRole(r.role)
          return categoryForSubmission ? theirCategories.includes(categoryForSubmission as never) : false
        })
        .map(r => r.email)

      const recipients = [...toRecipients, ...ccRecipients]

      const AUTHORITY_ROLE_LABELS: Record<string, string> = {
        director:            session.role,
        operations_manager:  'Operations Manager',
        club_manager:        'Club Manager',
        chairman:            'Chair of the Board',
      }

      const ratifResendId = await sendRatificationNotification(toRecipients, {
        description: row.description,
        statusLabel: STATUS_LABELS[status] ?? status,
        changedBy: session.directorName,
        changedByRole: AUTHORITY_ROLE_LABELS[myAuthority] ?? session.role,
        nextRatifier,
        submissionId: id,
        confirmedCost: effectiveCost,
        spendLimit: spendLimits[myAuthority] ?? 0,
        finalisedBySpend: finalised && myAuthority !== 'chairman',
        cc: ccRecipients,
      })
      if (recipients.length > 0) {
        await sql`
          INSERT INTO notification_log (submission_id, type, recipients, resend_id)
          VALUES (${id}, 'ratification', ${recipients.join(', ')}, ${ratifResendId ?? null})
        `
      }
    } catch (e) {
      console.error('[triage PATCH] Failed to send ratification notification:', e)
    }
  }

  if (category) {
    const prevCat = await sql`SELECT category FROM submissions WHERE id = ${id}`
    const oldCategory = (prevCat[0] as { category: string })?.category
    await sql`UPDATE submissions SET category = ${category} WHERE id = ${id}`
    if (category !== oldCategory) {
      await sql`
        INSERT INTO status_log (submission_id, old_status, new_status, changed_by, note)
        VALUES (${id}, ${oldCategory ?? ''}, ${oldCategory ?? ''}, ${session.directorName}, ${'Category changed from ' + (oldCategory ?? '?') + ' to ' + category})
      `
    }
  }

  return NextResponse.json({ ok: true, spendLimits, ...(emailDraft ? { emailDraft } : {}) })
}

export async function DELETE(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('bci_director_session')?.value
  const session = token ? await verifySession(token) : null

  if (!session || session.type !== 'director' || !isManager(session.role)) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
  }

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

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

