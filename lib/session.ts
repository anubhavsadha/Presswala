// Edge-safe session helpers (used by proxy.ts and server code).
import { jwtVerify, SignJWT } from 'jose'

export type Role = 'customer' | 'presswala' | 'admin'
export type Session = { uid: number; role: Role; name: string }

export const SESSION_COOKIE = 'pw_session'
export const SESSION_DAYS = 30

function key() {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 16) throw new Error('AUTH_SECRET must be set (16+ characters)')
  return new TextEncoder().encode(secret)
}

export async function signSession(s: Session) {
  return new SignJWT({ role: s.role, name: s.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(s.uid))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(key())
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'] })
    return { uid: Number(payload.sub), role: payload.role as Role, name: String(payload.name ?? '') }
  } catch {
    return null
  }
}

export const HOME_FOR_ROLE: Record<Role, string> = {
  customer: '/c',
  presswala: '/p',
  admin: '/admin',
}
