import { NextResponse, type NextRequest } from 'next/server'
import { HOME_FOR_ROLE, type Role, SESSION_COOKIE, verifySession } from './lib/session'

const AREA_ROLE: Record<string, Role> = { '/c': 'customer', '/p': 'presswala', '/admin': 'admin' }

// Fast, optimistic gate. Pages still re-check the role on the server via requireRole().
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value)
  const prefix = Object.keys(AREA_ROLE).find((p) => pathname === p || pathname.startsWith(p + '/'))

  if (prefix) {
    if (!session) return NextResponse.redirect(new URL('/login', req.url))
    if (session.role !== AREA_ROLE[prefix]) return NextResponse.redirect(new URL(HOME_FOR_ROLE[session.role], req.url))
  }
  if (session && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL(HOME_FOR_ROLE[session.role], req.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/c/:path*', '/p/:path*', '/admin/:path*', '/login', '/register'],
}
