// Deletes the demo presswalas (9000000001-3) and demo households (81000000xx) with all their
// orders, schedules, plans and khata entries. Real accounts are untouched; any real household
// that had picked a demo presswala simply goes back to choosing one.
import postgres from 'postgres'
import { loadEnv } from './env.mjs'

loadEnv()
const url = process.env.DATABASE_URL
const sql = postgres(url, {
  onnotice: () => {},
  ssl: /@(localhost|127\.0\.0\.1)[:/]/.test(url) ? false : 'require',
  prepare: !url.includes('pooler'),
})

const demo = sql`(phone IN ('9000000001', '9000000002', '9000000003') OR phone ~ '^81000000[0-9]{2}$')`
const removed = await sql.begin(async (tx) => {
  const ids = (await tx`SELECT id FROM users WHERE role <> 'admin' AND ${demo}`).map((r) => r.id)
  if (!ids.length) return 0
  // Orders reference households and areas without cascading from the customer side of every table.
  await tx`DELETE FROM orders WHERE customer_id = ANY(${ids}::bigint[]) OR presswala_id = ANY(${ids}::bigint[])`
  const r = await tx`DELETE FROM users WHERE id = ANY(${ids}::bigint[])`
  return r.count
})
console.log(removed ? `Removed ${removed} demo accounts and their data.` : 'No demo accounts found.')
await sql.end()
