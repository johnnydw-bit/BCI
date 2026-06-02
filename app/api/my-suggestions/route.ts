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
      quick_win_flag,
      scored_at,
      created_at
    FROM submissions
    WHERE (
        member_id = ${session.memberId}
        OR member_id = ${session.memberEmail}
        OR member_name = ${session.memberName}
      )
      AND deleted_at IS NULL
    ORDER BY created_at DESC
  `

  return NextResponse.json({ suggestions: rows })
}
