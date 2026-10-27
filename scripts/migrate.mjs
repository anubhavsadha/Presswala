// Applies db/schema.sql. Every statement is idempotent, so this is safe to run repeatedly.
import { readFileSync } from 'node:fs'
import postgres from 'postgres'
import { loadEnv } from './env.mjs'

loadEnv()
const sql = postgres(process.env.DATABASE_URL, {
  onnotice: () => {},
  ssl: /@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL) ? false : 'require',
  prepare: !process.env.DATABASE_URL.includes('pooler'),
})
const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')
await sql.unsafe(schema)
console.log('Schema applied.')
await sql.end()
