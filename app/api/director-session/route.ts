import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('bci_director_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session || session.type !== 'director') return NextResponse.json({ authenticated: false })
  return NextResponse.json({ authenticated: true, ...session })
}
