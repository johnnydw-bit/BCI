import { SignJWT, jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
const BRAMLEY_BASE = 'https://www.bramleygolfclub.co.uk'

export type SessionPayload =
  | { type: 'member'; memberId: string; memberName: string; memberEmail: string }
  | { type: 'director'; role: string; directorName: string; email: string }

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('8h')
    .sign(secret)
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export async function loginMember(
  memberId: string,
  pin: string
): Promise<{ success: boolean; memberName?: string; error?: string }> {
  const cookieJar: Record<string, string> = {}

  function setCookies(headers: Headers) {
    const raw = headers.getSetCookie?.() ?? []
    for (const c of raw) {
      const [pair] = c.split(';')
      const [k, v] = pair.split('=')
      if (k && v !== undefined) cookieJar[k.trim()] = v.trim()
    }
  }

  function cookieHeader() {
    return Object.entries(cookieJar)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ')
  }

  const commonHeaders = {
    'User-Agent': 'Mozilla/5.0 (compatible; BramleyBCI/1.0)',
    Accept: 'text/html,application/xhtml+xml',
    'Accept-Language': 'en-GB,en;q=0.9',
  }

  try {
    // Step 1 — get CSRF token
    const loginPage = await fetch(`${BRAMLEY_BASE}/login.php`, {
      headers: commonHeaders,
    })
    setCookies(loginPage.headers)
    const html = await loginPage.text()
    const csrfMatch = html.match(/name="_csrf_token"\s+value="([^"]+)"/)
    if (!csrfMatch) return { success: false, error: 'Could not reach Bramley website' }
    const csrf = csrfMatch[1]

    // Step 2 — submit credentials
    const body = new URLSearchParams({
      memberid: memberId,
      pin,
      _csrf_token: csrf,
    })
    const loginRes = await fetch(`${BRAMLEY_BASE}/login.php`, {
      method: 'POST',
      headers: {
        ...commonHeaders,
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookieHeader(),
        Referer: `${BRAMLEY_BASE}/login.php`,
      },
      body,
      redirect: 'manual',
    })
    setCookies(loginRes.headers)
    const loginHtml = await loginRes.text()

    if (loginHtml.includes('memberid') && loginHtml.includes('pin')) {
      return { success: false, error: 'Invalid member ID or PIN' }
    }

    // Step 3 — accept consent
    await fetch(`${BRAMLEY_BASE}/ttbconsent.php?action=accept`, {
      headers: { ...commonHeaders, Cookie: cookieHeader() },
    })

    // Step 4 — get member name from home page
    const home = await fetch(`${BRAMLEY_BASE}/home.php`, {
      headers: { ...commonHeaders, Cookie: cookieHeader() },
    })
    const homeHtml = await home.text()

    if (homeHtml.includes('login')) {
      return { success: false, error: 'Invalid member ID or PIN' }
    }

    const nameMatch = homeHtml.match(/Welcome[,\s]+([^<\n]+)/i)
    const memberName = nameMatch ? nameMatch[1].trim() : memberId

    return { success: true, memberName }
  } catch {
    return { success: false, error: 'Unable to reach Bramley website. Please try again.' }
  }
}
