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
  if (/@db\.[^.]+\.supabase\.co/.test(process.env.DATABASE_URL)) {
    console.error('DATABASE_URL uses the Supabase "Direct connection" host, which is IPv6-only and often unreachable.')
    console.error('Use the Transaction pooler string instead: Supabase -> Connect -> Transaction pooler (port 6543).')
    process.exit(1)
  }
}
