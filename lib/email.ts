import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)
const FROM = process.env.EMAIL_FROM ?? 'noreply@bramleygolfclub.co.uk'
const MANAGER_EMAIL = process.env.MANAGER_EMAIL!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bramley-bci.vercel.app'

// If DEBUG_EMAIL is set, all emails are redirected there regardless of recipient.
// Use this while Resend domain verification is pending.
const DEBUG_EMAIL = process.env.DEBUG_EMAIL

function resolveRecipient(to: string | string[]): string | string[] {
  if (DEBUG_EMAIL) {
    console.log(`[email] DEBUG_EMAIL active — redirecting to ${DEBUG_EMAIL} (was: ${JSON.stringify(to)})`)
    return DEBUG_EMAIL
  }
  return to
}

async function send(payload: { from: string; to: string | string[]; subject: string; html: string }) {
  const resolvedTo = resolveRecipient(payload.to)
  console.log(`[email] Sending "${payload.subject}" from ${payload.from} to ${JSON.stringify(resolvedTo)}`)
  const result = await resend.emails.send({ ...payload, to: resolvedTo as string | string[] })
  if (result.error) {
    console.error(`[email] Resend error:`, JSON.stringify(result.error))
  } else {
    console.log(`[email] Sent OK — id: ${result.data?.id}`)
  }
  return result
}

// Outlook-safe table-based header (no flexbox)
function emailHeader(bgColour: string, title: string, subtitle: string) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bgColour};border-radius:10px 10px 0 0">
      <tr>
        <td width="72" style="padding:16px 8px 16px 16px;vertical-align:middle">
          <img src="${APP_URL}/bramley-logo.jpg" alt="Bramley Golf Club" width="56" height="56" style="display:block;border-radius:8px;object-fit:cover" />
        </td>
        <td style="padding:16px 16px 16px 8px;vertical-align:middle">
          <h2 style="margin:0;font-size:20px;color:white;font-family:sans-serif">${title}</h2>
          <p style="margin:4px 0 0;font-size:14px;color:rgba(255,255,255,0.85);font-family:sans-serif">${subtitle}</p>
        </td>
      </tr>
    </table>
  `
}

// Outlook-safe button
function emailButton(href: string, label: string) {
  return `
    <table cellpadding="0" cellspacing="0" border="0" style="margin:16px 0">
      <tr>
        <td style="background:#1a3a5c;border-radius:10px;padding:0">
          <a href="${href}" style="display:inline-block;padding:12px 24px;color:white;font-family:sans-serif;font-weight:700;font-size:14px;text-decoration:none;border-radius:10px">${label}</a>
        </td>
      </tr>
    </table>
  `
}

export async function sendHAndSAlert(submission: {
  id: number
  description: string
  category: string
  aiSummary: string
}) {
  await send({
    from: FROM,
    to: MANAGER_EMAIL,
    subject: `⚠️ URGENT — Health & Safety suggestion flagged`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        ${emailHeader('#c0392b', '⚠️ Bramley Golf Club — Urgent H&amp;S Flag', 'Requires immediate attention')}
        <div style="padding:20px;background:#fff;border-radius:0 0 10px 10px;border:1px solid #ddd;border-top:none">
          <p style="font-family:sans-serif">A member suggestion has been flagged as having a <strong>Health &amp; Safety</strong> dimension and requires your immediate attention.</p>
          <table width="100%" cellpadding="8" cellspacing="0" border="0" style="margin:16px 0;border-collapse:collapse">
            <tr><td style="background:#f5f5f5;font-weight:600;width:140px;font-family:sans-serif">Category</td><td style="font-family:sans-serif">${submission.category}</td></tr>
            <tr><td style="background:#f5f5f5;font-weight:600;font-family:sans-serif">Summary</td><td style="font-family:sans-serif">${submission.aiSummary}</td></tr>
            <tr><td style="background:#f5f5f5;font-weight:600;font-family:sans-serif">Submission</td><td style="font-family:sans-serif">${submission.description}</td></tr>
          </table>
          ${emailButton(`${APP_URL}/triage`, 'View in Triage Report →')}
        </div>
      </div>
    `,
  })
}

export async function sendSubmitterUpdate(to: string, submission: {
  description: string
  scoreBand: string
  memberMsg: string
  costBand: string | null
  implComplexity: string | null
  suggestedTargetDate: string | null
}) {
  const bandLabels: Record<string, string> = {
    priority:       'Priority — high likelihood of implementation',
    active:         'Active queue — under consideration',
    holding:        'Holding — good idea, longer timeframe',
    low_priority:   'Low priority at this time',
    not_progressed: 'Not progressed',
    in_plan:        'Already in our improvement plan',
  }
  const bandLabel = bandLabels[submission.scoreBand] ?? submission.scoreBand

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  await send({
    from: FROM,
    to,
    subject: `Your Bramley GC improvement has been assessed`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        ${emailHeader('#1a3a5c', 'Bramley Golf Club', 'Continuous Improvement Programme')}
        <div style="padding:24px;background:#fff;border-radius:0 0 10px 10px;border:1px solid #ddd;border-top:none">
          <p style="color:#333;font-family:sans-serif">Thank you for taking the time to submit an improvement idea. Our committee has now assessed it.</p>

          <div style="background:#f5f7fa;border-radius:8px;padding:16px;margin:16px 0">
            <p style="margin:0 0 8px;font-size:13px;color:#666;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;font-family:sans-serif">Your improvement</p>
            <p style="margin:0;color:#333;font-family:sans-serif">${submission.description}</p>
          </div>

          <div style="background:#e8f4e8;border-left:4px solid #1e8449;padding:16px;margin:16px 0">
            <p style="margin:0 0 4px;font-size:13px;color:#1e8449;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;font-family:sans-serif">Assessment</p>
            <p style="margin:0;color:#333;font-weight:600;font-family:sans-serif">${bandLabel}</p>
          </div>

          <p style="color:#333;line-height:1.6;font-family:sans-serif">${submission.memberMsg}</p>

          ${submission.suggestedTargetDate ? `
          <p style="color:#555;font-size:14px;font-family:sans-serif">Indicative timeline: <strong>${fmt(submission.suggestedTargetDate)}</strong></p>
          ` : ''}

          <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
          <p style="color:#888;font-size:13px;font-family:sans-serif">You can track the status of your improvement at any time by signing in to the Bramley GC Continuous Improvement Programme.</p>
          ${emailButton(`${APP_URL}/my-improvements`, 'View my improvements →')}
          <p style="color:#aaa;font-size:12px;margin-top:16px;font-family:sans-serif">If you would prefer not to receive these emails, you can opt out when submitting future improvements.</p>
        </div>
      </div>
    `,
  })
}

export async function sendTriageReport(to: string[], periodStart: Date, periodEnd: Date, nextRunAt: Date, htmlReport: string) {
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  await send({
    from: FROM,
    to,
    subject: `Bramley GC — Triage Report (${fmt(periodStart)} – ${fmt(periodEnd)})`,
    html: `
      <div style="font-family:sans-serif;max-width:800px;margin:0 auto">
        ${emailHeader('#1a3a5c', 'Bramley Golf Club — Triage Report', `${fmt(periodStart)} – ${fmt(periodEnd)}`)}
        <div style="padding:24px;background:#fff;border-radius:0 0 10px 10px;border:1px solid #ddd;border-top:none">
          <p style="margin:0 0 16px;color:#555;font-size:14px;font-family:sans-serif">Next scheduled report: <strong>${fmt(nextRunAt)}</strong></p>
          ${emailButton(`${APP_URL}/triage`, 'Open Full Interactive Report →')}
          ${htmlReport}
        </div>
      </div>
    `,
  })
}
