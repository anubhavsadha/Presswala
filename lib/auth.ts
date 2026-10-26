import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { sql } from './db'
import { HOME_FOR_ROLE, type Role, type Session, SESSION_COOKIE, SESSION_DAYS, signSession, verifySession } from './session'

export async function getSession(): Promise<Session | null> {
  const store = await cookies()
  const s = await verifySession(store.get(SESSION_COOKIE)?.value)
  if (!s) return null
  // Deactivated accounts lose access immediately, not when the token expires.
  const [u] = await sql`SELECT active FROM users WHERE id = ${s.uid}`
  return u?.active ? s : null
}

export async function requireRole(role: Role): Promise<Session> {
  const s = await getSession()
  if (!s) redirect('/login')
  if (s.role !== role) redirect(HOME_FOR_ROLE[s.role])
  return s
}

export async function startSession(s: Session) {
  const store = await cookies()
  store.set(SESSION_COOKIE, await signSession(s), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 86400,
  })
}

export async function endSession() {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

// Accepts "98100 12345", "+91 9810012345", "09810012345" → "9810012345".
export function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '')
  return /^[6-9]\d{9}$/.test(digits) ? digits : null
}
