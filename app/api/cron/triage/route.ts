import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { runTriage } from '@/lib/triage'

const sql = neon(process.env.DATABASE_URL!)

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Skip if there are no unscored submissions — no point running AI or sending emails
  const pending = await sql`SELECT COUNT(*)::int AS n FROM submissions WHERE scored_at IS NULL AND deleted_at IS NULL`
  if ((pending[0].n as number) === 0) {
    console.log('[cron/triage] Skipped — no pending submissions')
    return NextResponse.json({ ok: true, skipped: 'no pending submissions' })
  }

  try {
    const result = await runTriage()
    return NextResponse.json({ ok: true, ...result })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('already running')) {
      console.log('[cron/triage] Skipped — triage already in progress')
      return NextResponse.json({ ok: true, skipped: 'already running' })
    }
    throw e
  }
}
