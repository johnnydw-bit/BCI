import { NextRequest, NextResponse } from 'next/server'
import { runTriage } from '@/lib/triage'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
