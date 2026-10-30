import { existsSync, readFileSync } from 'node:fs'

// Minimal .env loader for the CLI scripts (Next.js loads .env itself).
export function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    if (!existsSync(file)) continue
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.')
    process.exit(1)
  }
  checkUrl(process.env.DATABASE_URL)
  if (/@db\.[^.]+\.supabase\.co/.test(process.env.DATABASE_URL)) {
    console.error('DATABASE_URL uses the Supabase "Direct connection" host, which is IPv6-only and often unreachable.')
    console.error('Use the Transaction pooler string instead: Supabase -> Connect -> Transaction pooler (port 6543).')
    process.exit(1)
  }
}

// Catches the usual copy-paste mistakes before the database rejects the login.
function checkUrl(raw) {
  const fail = (msg) => { console.error('DATABASE_URL problem: ' + msg); process.exit(1) }
  const symbols = 'it looks like your password contains symbols such as @ # / % that break the URL. Reset it in Supabase to letters and numbers only.'
  if ((raw.match(/@/g) || []).length > 1 || raw.includes('#')) fail(symbols)
  let u
  try { u = new URL(raw) } catch {
    fail('it is not a valid URL. If your password has symbols like @ # / ? % :, reset it in Supabase to letters and numbers only.')
  }
  const user = decodeURIComponent(u.username)
  const pass = decodeURIComponent(u.password)
  if (!pass) fail('no password found. The format is postgresql://USER:PASSWORD@HOST:PORT/postgres')
  if (/YOUR-PASSWORD|^\[|\]$/.test(pass)) fail('the password still has the [YOUR-PASSWORD] placeholder or square brackets. Put only your real password.')
  if (u.hostname.endsWith('pooler.supabase.com') && !user.includes('.')) {
    fail(`the user is "${user}" but the Supabase pooler needs "postgres.<project-ref>", e.g. postgres.abcdxyz. Copy the full Transaction pooler string again.`)
  }
  console.log(`Connecting to ${u.hostname}:${u.port || 5432} as ${user} (password: ${pass.length} characters)`)
}
