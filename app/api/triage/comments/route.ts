import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth'
import { sql } from '@/lib/db'
import { getCategoriesForRole } from '@/lib/categories'

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('bci_director_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session || session.type !== 'director') {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
  }

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const rows = await sql`
    SELECT id, director_name, director_role, comment, created_at
    FROM director_comments
    WHERE submission_id = ${Number(id)}
    ORDER BY created_at ASC
  `
  return NextResponse.json({ comments: rows })
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('bci_director_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session || session.type !== 'director') {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
  }

  const { submissionId, comment } = await req.json()
  if (!submissionId || !comment?.trim()) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Verify the director can access this submission's category
  const subRow = await sql`SELECT category FROM submissions WHERE id = ${Number(submissionId)} AND deleted_at IS NULL`
  const category = (subRow[0] as { category: string } | undefined)?.category
  if (!category) return NextResponse.json({ error: 'Submission not found' }, { status: 404 })

  const allowed = getCategoriesForRole(session.role)
  if (!allowed.includes(category as never)) {
    return NextResponse.json({ error: 'Not authorised for this category' }, { status: 403 })
  }

  await sql`
    INSERT INTO director_comments (submission_id, director_name, director_role, comment)
    VALUES (${Number(submissionId)}, ${session.directorName}, ${session.role}, ${comment.trim()})
  `
  return NextResponse.json({ ok: true })
}
