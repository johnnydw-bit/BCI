import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth'
import { sql } from '@/lib/db'
import { isManager, DEFAULT_SPEND_LIMITS, isDecisionFinalised } from '@/lib/categories'
import { sendBudgetRequestEmail, sendBudgetDecisionEmail } from '@/lib/email'

export function financialYear(date = new Date()): number {
  // July 1 start: month >= 6 (0-indexed July) means we're in the new FY
  return date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1
}

async function loadSpendLimits(): Promise<Record<string, number>> {
  const rows = await sql`SELECT key, value FROM config WHERE key IN ('SPEND_LIMIT_DIRECTOR','SPEND_LIMIT_OPERATIONS_MANAGER','SPEND_LIMIT_CLUB_MANAGER','SPEND_LIMIT_CHAIRMAN')`
  const map: Record<string, number> = { ...DEFAULT_SPEND_LIMITS }
  for (const r of rows as Array<{ key: string; value: string }>) {
    if (r.key === 'SPEND_LIMIT_DIRECTOR')           map.director           = Number(r.value)
    if (r.key === 'SPEND_LIMIT_OPERATIONS_MANAGER') map.operations_manager = Number(r.value)
    if (r.key === 'SPEND_LIMIT_CLUB_MANAGER')       map.club_manager       = Number(r.value)
    if (r.key === 'SPEND_LIMIT_CHAIRMAN')           map.chairman           = Number(r.value)
  }
  return map
}

async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get('bci_director_session')?.value
  return token ? await verifySession(token) : null
}

// GET /api/budget?year=2025
// Returns pot, allocations, live spend, pending requests
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || session.type !== 'director') return NextResponse.json({ error: 'Not authorised' }, { status: 403 })

  const year = Number(req.nextUrl.searchParams.get('year') ?? financialYear())

  const potRows = await sql`SELECT * FROM budget_pots WHERE financial_year = ${year}`
  const pot = potRows[0] as { id: number; financial_year: number; total_amount: number } | undefined

  const allocations = pot
    ? await sql`SELECT category, percentage FROM budget_allocations WHERE budget_pot_id = ${pot.id} ORDER BY category`
    : []

  // Live spend: sum confirmed_cost for approved/in_plan/implemented in this FY
  const spendRows = pot
    ? await sql`
        SELECT category, COALESCE(SUM(confirmed_cost), 0) AS spent
        FROM submissions
        WHERE budget_year = ${year}
          AND status IN ('approved', 'in_plan', 'implemented')
          AND deleted_at IS NULL
          AND withdrawn_at IS NULL
        GROUP BY category
      `
    : []

  const pendingRequests = pot
    ? await sql`
        SELECT br.*, s.description AS submission_description
        FROM budget_requests br
        LEFT JOIN submissions s ON s.id = br.submission_id
        WHERE br.budget_pot_id = ${pot.id}
        ORDER BY br.created_at DESC
      `
    : []

  return NextResponse.json({ pot: pot ?? null, allocations, spend: spendRows, pendingRequests, year })
}

// POST /api/budget
// action: 'setup' | 'request'
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.type !== 'director') return NextResponse.json({ error: 'Not authorised' }, { status: 403 })

  const body = await req.json()
  const { action } = body

  if (action === 'setup') {
    if (!isManager(session.role)) return NextResponse.json({ error: 'Not authorised' }, { status: 403 })

    const { year, totalAmount, allocations } = body as {
      year: number
      totalAmount: number
      allocations: Array<{ category: string; percentage: number }>
    }

    const total = allocations.reduce((s, a) => s + a.percentage, 0)
    if (Math.abs(total - 100) > 0.01) return NextResponse.json({ error: 'Allocations must sum to 100%' }, { status: 400 })

    // Upsert pot
    const potRows = await sql`
      INSERT INTO budget_pots (financial_year, total_amount, updated_at)
      VALUES (${year}, ${totalAmount}, NOW())
      ON CONFLICT (financial_year) DO UPDATE SET total_amount = ${totalAmount}, updated_at = NOW()
      RETURNING id
    `
    const potId = (potRows[0] as { id: number }).id

    // Replace allocations
    await sql`DELETE FROM budget_allocations WHERE budget_pot_id = ${potId}`
    for (const a of allocations) {
      await sql`INSERT INTO budget_allocations (budget_pot_id, category, percentage) VALUES (${potId}, ${a.category}, ${a.percentage})`
    }

    return NextResponse.json({ ok: true })
  }

  if (action === 'request') {
    const { submissionId, type, fromCategory, toCategory, amount, justification } = body as {
      submissionId: number
      type: 'transfer' | 'overspend'
      fromCategory: string | null
      toCategory: string
      amount: number
      justification: string
    }

    const year = financialYear()
    const potRows = await sql`SELECT id FROM budget_pots WHERE financial_year = ${year}`
    const pot = potRows[0] as { id: number } | undefined
    if (!pot) return NextResponse.json({ error: 'No budget configured for this financial year' }, { status: 400 })

    const reqRows = await sql`
      INSERT INTO budget_requests (budget_pot_id, submission_id, type, from_category, to_category, amount, justification, requested_by)
      VALUES (${pot.id}, ${submissionId}, ${type}, ${fromCategory || null}, ${toCategory}, ${amount}, ${justification}, ${session.directorName})
      RETURNING id
    `
    const requestId = (reqRows[0] as { id: number }).id

    // Link request to submission
    await sql`UPDATE submissions SET budget_request_id = ${requestId} WHERE id = ${submissionId}`

    // Email Chair and Club Manager
    try {
      const subRow = await sql`SELECT description FROM submissions WHERE id = ${submissionId}`
      const description = (subRow[0] as { description: string }).description
      const approverRows = await sql`
        SELECT email FROM director_roles
        WHERE role IN ('Chair of the Board', 'Club Manager', 'Super Admin') AND active = TRUE AND email IS NOT NULL
      `
      const approverEmails = (approverRows as Array<{ email: string }>).map(r => r.email)
      await sendBudgetRequestEmail(approverEmails, {
        requestedBy: session.directorName,
        type,
        fromCategory: fromCategory ?? undefined,
        toCategory,
        amount,
        justification,
        submissionDescription: description,
        submissionId,
      })
    } catch (e) {
      console.error('[budget] Failed to send request email:', e)
    }

    return NextResponse.json({ ok: true, requestId })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// PATCH /api/budget — approve or reject a request
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session || session.type !== 'director') return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
  if (!isManager(session.role)) return NextResponse.json({ error: 'Not authorised' }, { status: 403 })

  const { requestId, decision, decisionNote } = await req.json() as {
    requestId: number
    decision: 'approved' | 'rejected'
    decisionNote?: string
  }

  // Load request
  const reqRows = await sql`
    SELECT br.*, bp.total_amount, bp.financial_year
    FROM budget_requests br
    JOIN budget_pots bp ON bp.id = br.budget_pot_id
    WHERE br.id = ${requestId} AND br.status = 'pending'
  `
  const request = reqRows[0] as {
    id: number; budget_pot_id: number; submission_id: number | null
    type: string; from_category: string | null; to_category: string
    amount: number; requested_by: string; financial_year: number; total_amount: number
  } | undefined
  if (!request) return NextResponse.json({ error: 'Request not found or already decided' }, { status: 404 })

  // Authority check: amount determines if CM can approve or needs Chair
  const spendLimits = await loadSpendLimits()
  const myAuthority = session.role === 'Chair of the Board' ? 'chairman'
    : (session.role === 'Club Manager' || session.role === 'Super Admin') ? 'club_manager'
    : null
  if (!myAuthority) return NextResponse.json({ error: 'Not authorised' }, { status: 403 })

  const canApprove = isDecisionFinalised(myAuthority, Number(request.amount), spendLimits)
  if (!canApprove) return NextResponse.json({ error: 'Amount exceeds your signoff limit — Chair approval required' }, { status: 403 })

  // Record decision
  await sql`
    UPDATE budget_requests
    SET status = ${decision}, decided_by = ${session.directorName}, decided_at = NOW(), decision_note = ${decisionNote || null}
    WHERE id = ${requestId}
  `

  // If approved transfer: adjust allocations
  if (decision === 'approved' && request.type === 'transfer' && request.from_category) {
    const potTotal = Number(request.total_amount)
    const transferPct = (Number(request.amount) / potTotal) * 100

    await sql`
      UPDATE budget_allocations SET percentage = GREATEST(0, percentage - ${transferPct})
      WHERE budget_pot_id = ${request.budget_pot_id} AND category = ${request.from_category}
    `
    await sql`
      UPDATE budget_allocations SET percentage = LEAST(100, percentage + ${transferPct})
      WHERE budget_pot_id = ${request.budget_pot_id} AND category = ${request.to_category}
    `
  }

  // Clear pending request link from submission
  if (request.submission_id) {
    await sql`UPDATE submissions SET budget_request_id = NULL WHERE id = ${request.submission_id}`
  }

  // Notify requesting director
  try {
    const requesterRows = await sql`SELECT email FROM director_roles WHERE name = ${request.requested_by} AND active = TRUE`
    const requesterEmail = (requesterRows[0] as { email: string } | undefined)?.email
    if (requesterEmail) {
      await sendBudgetDecisionEmail(requesterEmail, {
        requestedBy: request.requested_by,
        decidedBy: session.directorName,
        decision,
        decisionNote,
        type: request.type as 'transfer' | 'overspend',
        toCategory: request.to_category,
        amount: Number(request.amount),
        submissionId: request.submission_id ?? undefined,
      })
    }
  } catch (e) {
    console.error('[budget] Failed to send decision email:', e)
  }

  return NextResponse.json({ ok: true })
}
