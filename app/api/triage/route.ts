import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth'
import { sql } from '@/lib/db'
import { DIRECTOR_CATEGORIES, isManager } from '@/lib/categories'
import { generateStatusEmail } from '@/lib/ai'
import { sendStatusChangeEmail } from '@/lib/email'

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

  const allowedCategories = DIRECTOR_CATEGORIES[session.role] ?? []

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
      s.confirmed_cost,
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

  return NextResponse.json({
    role: session.role,
    directorName: session.directorName,
    submissions: rows,
    isManager: isManager(session.role),
  })
}

export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('bci_director_session')?.value
  const session = token ? await verifySession(token) : null

  if (!session || session.type !== 'director' || !isManager(session.role)) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
  }

  const {
    id, status, category, suggested_owner, notes,
    score_override, score_override_reason,
    confirmed_target_date, confirmed_cost,
  } = await req.json()

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  if (suggested_owner !== undefined) {
    await sql`UPDATE submissions SET suggested_owner = ${suggested_owner || null} WHERE id = ${id}`
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
             confirmed_target_date, ai_narrative, notes
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
    }
    const oldStatus = row?.status

    await sql`
      UPDATE submissions
      SET status = ${status},
          confirmed_target_date = COALESCE(${confirmed_target_date ?? null}, confirmed_target_date)
      WHERE id = ${id}
    `
    await sql`
      INSERT INTO status_log (submission_id, old_status, new_status, changed_by)
      VALUES (${id}, ${oldStatus}, ${status}, ${session.directorName})
    `

    // Send AI-generated email to member if they have email and haven't opted out
    if (row?.member_email && !row.email_opt_out) {
      try {
        const configRows = await sql`SELECT key, value FROM config WHERE key IN ('COMMS_TONE', 'COMMS_SIGNOFF')`
        const cfg = Object.fromEntries((configRows as Array<{ key: string; value: string }>).map((r) => [r.key, r.value]))
        const tone = (cfg['COMMS_TONE'] ?? 'friendly') as 'friendly' | 'formal'
        const signoff = cfg['COMMS_SIGNOFF'] ?? 'The Board, Bramley Golf Club'
        const targetDate = confirmed_target_date ?? row.confirmed_target_date ?? null

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

        await sendStatusChangeEmail(row.member_email!, {
          description: row.description,
          statusLabel: STATUS_LABELS[status] ?? status,
          emailBody,
          memberName: row.member_name,
        })
      } catch (e) {
        console.error('[triage PATCH] Failed to send status change email:', e)
      }
    }
  }

  if (category) {
    await sql`UPDATE submissions SET category = ${category} WHERE id = ${id}`
  }

  return NextResponse.json({ ok: true })
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

