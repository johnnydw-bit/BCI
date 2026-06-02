import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth'

export async function POST() {
  const cookieStore = await cookies()
  const token = cookieStore.get('bci_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session || session.type !== 'director' || session.role !== 'Club Manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Call the cron endpoint internally using the CRON_SECRET
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bci-kappa.vercel.app'
  const res = await fetch(`${baseUrl}/api/cron/triage`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    return NextResponse.json({ error: json.error ?? 'Triage failed' }, { status: 500 })
  }

  return NextResponse.json(json)
}
