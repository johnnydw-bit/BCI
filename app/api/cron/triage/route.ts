import { NextRequest, NextResponse } from 'next/server'
import { runTriage } from '@/lib/triage'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runTriage()
  return NextResponse.json({ ok: true, ...result })
}
