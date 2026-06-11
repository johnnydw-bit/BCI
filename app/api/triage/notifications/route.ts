import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth'
import { sql } from '@/lib/db'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

interface NotificationRow {
  id: number
  type: string
  recipients: string
  resend_id: string | null
  sent_at: string
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('bci_director_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session || session.type !== 'director') {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
  }

  const submissionId = req.nextUrl.searchParams.get('submissionId')
  if (!submissionId) return NextResponse.json({ error: 'Missing submissionId' }, { status: 400 })

  const rows = await sql`
    SELECT id, type, recipients, resend_id, sent_at
    FROM notification_log
    WHERE submission_id = ${Number(submissionId)}
    ORDER BY sent_at DESC
  `

  const entries = rows as unknown as NotificationRow[]

  // Enrich with Resend status for entries that have an ID
  const enriched = await Promise.all(
    entries.map(async (row) => {
      if (!row.resend_id) return { ...row, last_event: null }
      try {
        const result = await resend.emails.get(row.resend_id)
        return { ...row, last_event: (result.data as { last_event?: string } | null)?.last_event ?? null }
      } catch {
        return { ...row, last_event: null }
      }
    })
  )

  return NextResponse.json({ notifications: enriched })
}
