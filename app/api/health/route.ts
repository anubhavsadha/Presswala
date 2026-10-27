import { sql } from '@/lib/db'

// Reports what is wrong without leaking secrets, so a failed deploy is quick to diagnose.
export async function GET() {
  const url = process.env.DATABASE_URL
  if (!url) return Response.json({ ok: false, error: 'DATABASE_URL is not set' }, { status: 500 })
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 16) {
    return Response.json({ ok: false, error: 'AUTH_SECRET is missing or shorter than 16 characters' }, { status: 500 })
  }
  let host = ''
  try { host = new URL(url).hostname } catch { /* reported below */ }
  try {
    await sql`SELECT 1`
  } catch (e) {
    const err = e as { code?: string; message?: string }
    const hint = /^db\..*\.supabase\.co$/.test(host)
      ? 'This is the Supabase "Direct connection" host (IPv6 only). Use the Transaction pooler string instead.'
      : err.code === '28P01' ? 'Wrong database password in DATABASE_URL.' : undefined
    return Response.json({ ok: false, error: 'Cannot connect to database', code: err.code, host, hint }, { status: 500 })
  }
  const [t] = await sql<{ ready: boolean }[]>`SELECT to_regclass('public.users') IS NOT NULL AS ready`
  if (!t.ready) {
    return Response.json({ ok: false, error: 'Connected, but tables are missing. Run `npm run db:setup` against this database.' }, { status: 500 })
  }
  return Response.json({ ok: true })
}
