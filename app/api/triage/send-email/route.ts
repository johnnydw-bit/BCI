import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth'
import { sendStatusChangeEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('bci_director_session')?.value
  const session = token ? await verifySession(token) : null

  if (!session || session.type !== 'director') {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
  }

  const { to, body, memberName, description, statusLabel, submissionId } = await req.json()

  if (!to || !body) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    await sendStatusChangeEmail(to, {
      description,
      statusLabel,
      emailBody: body,
      memberName: memberName ?? null,
      submissionId: submissionId ?? undefined,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[send-email] Failed:', e)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
