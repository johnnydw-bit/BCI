import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { generateBackupCsv } from '@/lib/backup'
import { sendBackupEmail } from '@/lib/email'

export async function GET(req: NextRequest) {
  // Verify Vercel cron secret
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Find Operations Manager email(s)
  const recipients = await sql`
    SELECT email FROM director_roles
    WHERE role = 'Operations Manager' AND active = TRUE
  `

  if (recipients.length === 0) {
    console.log('[backup] No active Operations Manager found — skipping backup email')
    return NextResponse.json({ ok: true, skipped: 'no recipients' })
  }

  // Generate CSV
  const rows = await sql`
    SELECT * FROM submissions WHERE deleted_at IS NULL ORDER BY id ASC
  `
  const csv = generateBackupCsv(rows as Record<string, unknown>[])
  const filename = `bramley-backup-${new Date().toISOString().slice(0, 10)}.csv`

  // Send to each Operations Manager
  const emails = (recipients as Array<{ email: string }>).map((r) => r.email)
  for (const email of emails) {
    try {
      await sendBackupEmail(email, filename, csv)
      console.log(`[backup] Sent backup to ${email}`)
    } catch (e) {
      console.error(`[backup] Failed to send to ${email}:`, e)
    }
  }

  return NextResponse.json({ ok: true, rows: rows.length, recipients: emails })
}
