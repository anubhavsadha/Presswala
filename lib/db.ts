import 'server-only'
import postgres from 'postgres'

declare global {
  var __sql: postgres.Sql | undefined
}

// One pool per server process; reused across hot reloads in dev.
export const sql =
  globalThis.__sql ??
  postgres(process.env.DATABASE_URL!, {
    max: Number(process.env.DB_POOL_MAX ?? 5),
    idle_timeout: 20,
    onnotice: () => {},
    // NUMERIC columns come back as strings by default; money values here are small.
    types: {
      // BIGSERIAL ids fit comfortably in a JS number; avoid string ids leaking everywhere.
      bigint: { to: 20, from: [20], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
      numeric: { to: 1700, from: [1700], serialize: String, parse: Number },
      // Keep DATE columns as 'YYYY-MM-DD' strings so no timezone shifting can happen.
      date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x },
    },
    transform: { undefined: null },
    prepare: !process.env.DATABASE_URL?.includes('pooler'),
  })

if (process.env.NODE_ENV !== 'production') globalThis.__sql = sql
