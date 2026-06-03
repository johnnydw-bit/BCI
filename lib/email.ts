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
        <div style="background:#1a3a5c;padding:20px;color:white;border-radius:10px 10px 0 0">
          <h2 style="margin:0">⛳ Bramley GC — Urgent H&amp;S Flag</h2>
        </div>
        <div style="padding:20px;background:#fff;border-radius:0 0 10px 10px;border:1px solid #ddd;border-top:none">
          <p>A member suggestion has been flagged as having a <strong>Health &amp; Safety</strong> dimension and requires your immediate attention.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:8px;background:#f5f5f5;font-weight:600;width:140px">Category</td><td style="padding:8px">${submission.category}</td></tr>
            <tr><td style="padding:8px;background:#f5f5f5;font-weight:600">Summary</td><td style="padding:8px">${submission.aiSummary}</td></tr>
            <tr><td style="padding:8px;background:#f5f5f5;font-weight:600">Submission</td><td style="padding:8px">${submission.description}</td></tr>
          </table>
          <a href="${APP_URL}/triage" style="display:inline-block;background:#1a3a5c;color:white;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700">View in Triage Report →</a>
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
    priority: 'Priority — high likelihood of implementation',
    active: 'Active queue — under consideration',
    holding: 'Holding — good idea, longer timeframe',
    low_priority: 'Low priority at this time',
    not_progressed: 'Not progressed',
    in_plan: 'Already in our improvement plan',
  }
  const bandLabel = bandLabels[submission.scoreBand] ?? submission.scoreBand

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  await send({
    from: FROM,
    to,
    subject: `Your Bramley GC improvement has been assessed`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#1a3a5c;padding:20px;color:white;border-radius:10px 10px 0 0">
          <h2 style="margin:0">⛳ Bramley Golf Club</h2>
          <p style="margin:6px 0 0;opacity:0.85">Continuous Improvement Programme</p>
        </div>
        <div style="padding:24px;background:#fff;border-radius:0 0 10px 10px;border:1px solid #ddd;border-top:none">
          <p style="color:#333">Thank you for taking the time to submit an improvement idea. Our committee has now assessed it.</p>

          <div style="background:#f5f7fa;border-radius:8px;padding:16px;margin:16px 0">
            <p style="margin:0 0 8px;font-size:13px;color:#666;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Your improvement</p>
            <p style="margin:0;color:#333">${submission.description}</p>
          </div>

          <div style="background:#e8f4e8;border-left:4px solid #1e8449;border-radius:0 8px 8px 0;padding:16px;margin:16px 0">
            <p style="margin:0 0 4px;font-size:13px;color:#1e8449;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Assessment</p>
            <p style="margin:0;color:#333;font-weight:600">${bandLabel}</p>
          </div>

          <p style="color:#333;line-height:1.6">${submission.memberMsg}</p>

          ${submission.suggestedTargetDate ? `
          <p style="color:#555;font-size:14px">Indicative timeline: <strong>${fmt(submission.suggestedTargetDate)}</strong></p>
          ` : ''}

          <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
          <p style="color:#888;font-size:13px">You can track the status of your improvement at any time by signing in to the Bramley GC Continuous Improvement Programme.</p>
          <a href="${APP_URL}/my-improvements" style="display:inline-block;background:#1a3a5c;color:white;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700">View my improvements →</a>
          <p style="color:#aaa;font-size:12px;margin-top:16px">If you would prefer not to receive these emails, you can opt out when submitting future improvements.</p>
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
    subject: `Bramley GC — Suggestion Triage Report (${fmt(periodStart)} – ${fmt(periodEnd)})`,
    html: `
      <div style="font-family:sans-serif;max-width:800px;margin:0 auto">
        <div style="background:#1a3a5c;padding:20px;color:white;border-radius:10px 10px 0 0">
          <h2 style="margin:0">⛳ Bramley GC — Triage Report</h2>
          <p style="margin:8px 0 0;opacity:0.85">${fmt(periodStart)} – ${fmt(periodEnd)}</p>
        </div>
        <div style="padding:20px;background:#fff;border-radius:0 0 10px 10px;border:1px solid #ddd;border-top:none">
          <p>Next scheduled report: <strong>${fmt(nextRunAt)}</strong></p>
          <a href="${APP_URL}/triage" style="display:inline-block;background:#1a3a5c;color:white;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700;margin-bottom:24px">Open Full Interactive Report →</a>
          ${htmlReport}
        </div>
      </div>
    `,
  })
}
