import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('bci_session')?.value
  const session = token ? await verifySession(token) : null

  if (!session || session.type !== 'member') {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const rows = await sql`
    SELECT
      id,
      description,
      category,
      status,
      member_msg,
      score_band,
      cost_band,
      impl_complexity,
      suggested_target_date,
      confirmed_target_date,
      quick_win_flag,
      scored_at,
      created_at,
      withdrawn_at
    FROM submissions
    WHERE (
        member_id = ${session.memberId}
        OR member_id = ${session.memberEmail}
        OR member_name = ${session.memberName}
      )
      AND deleted_at IS NULL
    ORDER BY created_at DESC
  `

  // Fetch status history for each submission
  const ids = (rows as Array<{ id: number }>).map((r) => r.id)

  let historyMap: Record<number, Array<{ new_status: string; changed_at: string }>> = {}
  if (ids.length > 0) {
    const histRows = await sql`
      SELECT submission_id, new_status, changed_at
      FROM status_log
      WHERE submission_id = ANY(${ids})
        AND new_status != 'withdrawn'
      ORDER BY changed_at ASC
    `
    for (const h of histRows as Array<{ submission_id: number; new_status: string; changed_at: string }>) {
      if (!historyMap[h.submission_id]) historyMap[h.submission_id] = []
      historyMap[h.submission_id].push({ new_status: h.new_status, changed_at: h.changed_at })
    }
  }

  const suggestions = (rows as Array<Record<string, unknown>>).map((r) => ({
    ...r,
    history: historyMap[r.id as number] ?? [],
  }))

  return NextResponse.json({ suggestions })
}
