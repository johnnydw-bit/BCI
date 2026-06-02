import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)
const FROM = process.env.EMAIL_FROM ?? 'noreply@bramleygc.co.uk'
const MANAGER_EMAIL = process.env.MANAGER_EMAIL!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bramley-bci.vercel.app'

export async function sendHAndSAlert(submission: {
  id: number
  description: string
  category: string
  aiSummary: string
}) {
  await resend.emails.send({
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

export async function sendTriageReport(to: string[], periodStart: Date, periodEnd: Date, nextRunAt: Date, htmlReport: string) {
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  await resend.emails.send({
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
