import { sql } from '@/lib/db'
import { NextRequest } from 'next/server'

const MAX_ATTEMPTS = 5
const WINDOW_MINUTES = 15

/** Extract the best available IP from request headers. */
export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

/**
 * Check whether this IP + identifier combination is currently rate-limited.
 * Returns true if the caller should be blocked (≥ MAX_ATTEMPTS in window).
 */
export async function isRateLimited(ip: string, identifier: string): Promise<boolean> {
  // Use interval arithmetic via NOW() - (minutes * interval '1 minute') to avoid
  // injecting the number inside a string literal (Neon parameterises values)
  const windowSeconds = WINDOW_MINUTES * 60
  const rows = await sql`
    SELECT COUNT(*)::int AS cnt
    FROM login_attempts
    WHERE ip = ${ip}
      AND identifier = ${identifier}
      AND attempted_at > NOW() - (${windowSeconds} * INTERVAL '1 second')
  `
  const cnt = (rows[0] as { cnt: number }).cnt
  return cnt >= MAX_ATTEMPTS
}

/**
 * Record a failed login attempt.
 */
export async function recordFailedAttempt(ip: string, identifier: string): Promise<void> {
  await sql`
    INSERT INTO login_attempts (ip, identifier) VALUES (${ip}, ${identifier})
  `
}

/**
 * How many minutes until the lockout expires (approx).
 */
export async function lockoutMinutesRemaining(ip: string, identifier: string): Promise<number> {
  const windowSeconds = WINDOW_MINUTES * 60
  const rows = await sql`
    SELECT attempted_at FROM login_attempts
    WHERE ip = ${ip}
      AND identifier = ${identifier}
      AND attempted_at > NOW() - (${windowSeconds} * INTERVAL '1 second')
    ORDER BY attempted_at ASC
    LIMIT 1
  `
  if (rows.length === 0) return 0
  const oldest = new Date((rows[0] as { attempted_at: string }).attempted_at)
  const unlockAt = new Date(oldest.getTime() + WINDOW_MINUTES * 60 * 1000)
  return Math.max(0, Math.ceil((unlockAt.getTime() - Date.now()) / 60000))
}
