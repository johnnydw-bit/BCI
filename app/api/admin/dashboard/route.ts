import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth'
import { isManager } from '@/lib/categories'
import { sql } from '@/lib/db'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('bci_session')?.value
  const session = token ? await verifySession(token) : null

  if (!session || session.type !== 'director' || !isManager(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [byStatus, byCategory, scoreDist, quickWins, totals] = await Promise.all([
    sql`
      SELECT status, COUNT(*)::int AS count
      FROM submissions
      WHERE deleted_at IS NULL AND withdrawn_at IS NULL
      GROUP BY status
      ORDER BY count DESC
    `,
    sql`
      SELECT category, COUNT(*)::int AS count, ROUND(AVG(score)::numeric, 2) AS avg_score
      FROM submissions
      WHERE deleted_at IS NULL AND withdrawn_at IS NULL AND score IS NOT NULL
      GROUP BY category
      ORDER BY count DESC
    `,
    sql`
      SELECT score_band AS band, COUNT(*)::int AS count
      FROM submissions
      WHERE deleted_at IS NULL AND withdrawn_at IS NULL AND score_band IS NOT NULL
      GROUP BY score_band
      ORDER BY count DESC
    `,
    sql`
      SELECT COUNT(*)::int AS cnt FROM submissions
      WHERE deleted_at IS NULL AND withdrawn_at IS NULL AND quick_win_flag = TRUE
    `,
    sql`
      SELECT COUNT(*)::int AS total, ROUND(AVG(score)::numeric, 2) AS avg_score
      FROM submissions
      WHERE deleted_at IS NULL AND withdrawn_at IS NULL AND score IS NOT NULL
    `,
  ])

  return NextResponse.json({
    byStatus,
    byCategory,
    scoreDist,
    quickWins: (quickWins[0] as { cnt: number }).cnt ?? 0,
    totalScored: (totals[0] as { total: number }).total ?? 0,
    avgScore: (totals[0] as { avg_score: number | null }).avg_score ?? null,
  })
}
