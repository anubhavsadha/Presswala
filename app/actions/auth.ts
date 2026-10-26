'use server'
import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { sql } from '@/lib/db'
import { endSession, normalizePhone, startSession } from '@/lib/auth'
import { HOME_FOR_ROLE, type Role } from '@/lib/session'
import defaultPrices from '@/db/default-prices.json'
import { num, str } from './util'

export type FormState = { error?: string; ok?: string } | undefined

// Slows down password guessing. Per server instance; put a shared store (e.g. Redis) in front when scaling out.
const attempts = new Map<string, { n: number; until: number }>()

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const phone = normalizePhone(str(fd, 'phone'))
  const password = str(fd, 'password')
  if (!phone || !password) return { error: 'Enter your 10-digit mobile number and password.' }

  const a = attempts.get(phone)
  if (a && a.until > Date.now()) return { error: 'Too many attempts. Try again in a few minutes.' }

  const [u] = await sql<{ id: number; role: Role; name: string; password_hash: string; active: boolean }[]>`
    SELECT id, role, name, password_hash, active FROM users WHERE phone = ${phone}`
  if (!u || !(await bcrypt.compare(password, u.password_hash))) {
    const n = (a?.n ?? 0) + 1
    attempts.set(phone, { n, until: n >= 5 ? Date.now() + 5 * 60_000 : 0 })
    return { error: 'Wrong mobile number or password.' }
  }
  if (!u.active) return { error: 'This account has been deactivated. Contact support.' }
  attempts.delete(phone)
  await startSession({ uid: u.id, role: u.role, name: u.name })
  redirect(HOME_FOR_ROLE[u.role])
}

function validateBasics(fd: FormData) {
  const name = str(fd, 'name')
  const phone = normalizePhone(str(fd, 'phone'))
  const password = str(fd, 'password')
  if (name.length < 2) return { error: 'Please enter your name.' } as const
  if (!phone) return { error: 'Enter a valid 10-digit Indian mobile number.' } as const
  if (password.length < 6) return { error: 'Password must be at least 6 characters.' } as const
  return { name, phone, password } as const
}

export async function registerCustomer(_: FormState, fd: FormData): Promise<FormState> {
  const b = validateBasics(fd)
  if ('error' in b) return b
  const areaId = num(fd, 'area_id')
  const address = str(fd, 'address')
  if (!areaId) return { error: 'Choose your sector / society.' }
  if (address.length < 3) return { error: 'Enter your house / flat number and tower.' }
  const [area] = await sql`SELECT id FROM areas WHERE id = ${areaId} AND active`
  if (!area) return { error: 'Choose your sector / society.' }

  const hash = await bcrypt.hash(b.password, 10)
  let uid: number
  try {
    uid = await sql.begin(async (tx) => {
      const [u] = await tx<{ id: number }[]>`
        INSERT INTO users (role, name, phone, password_hash) VALUES ('customer', ${b.name}, ${b.phone}, ${hash})
        RETURNING id`
      await tx`
        INSERT INTO households (user_id, area_id, address, landmark, lat, lng)
        VALUES (${u.id}, ${areaId}, ${address}, ${str(fd, 'landmark')}, ${num(fd, 'lat')}, ${num(fd, 'lng')})`
      return u.id
    })
  } catch (e) {
    if ((e as { code?: string }).code === '23505') return { error: 'This mobile number is already registered. Log in instead.' }
    throw e
  }
  await startSession({ uid, role: 'customer', name: b.name })
  redirect('/c/presswala')
}

export async function registerPresswala(_: FormState, fd: FormData): Promise<FormState> {
  const b = validateBasics(fd)
  if ('error' in b) return b
  const shop = str(fd, 'shop_name') || `${b.name} Press`
  const areaIds = fd.getAll('area_ids').map(Number).filter(Boolean)
  if (!areaIds.length) return { error: 'Choose at least one sector / society you serve.' }

  const hash = await bcrypt.hash(b.password, 10)
  let uid: number
  try {
    uid = await sql.begin(async (tx) => {
      const [u] = await tx<{ id: number }[]>`
        INSERT INTO users (role, name, phone, password_hash) VALUES ('presswala', ${b.name}, ${b.phone}, ${hash})
        RETURNING id`
      await tx`
        INSERT INTO presswalas (user_id, shop_name, shop_address, upi_id, lat, lng)
        VALUES (${u.id}, ${shop}, ${str(fd, 'shop_address')}, ${str(fd, 'upi_id')}, ${num(fd, 'lat')}, ${num(fd, 'lng')})`
      await tx`
        INSERT INTO presswala_areas (presswala_id, area_id)
        SELECT ${u.id}, id FROM areas WHERE id = ANY(${areaIds}::bigint[]) AND active`
      for (const [i, it] of defaultPrices.entries()) {
        await tx`
          INSERT INTO price_items (presswala_id, code, name, price, is_regular, sort_order)
          VALUES (${u.id}, ${it.code}, ${it.name}, ${it.price}, ${it.is_regular}, ${i})`
      }
      return u.id
    })
  } catch (e) {
    if ((e as { code?: string }).code === '23505') return { error: 'This mobile number is already registered. Log in instead.' }
    throw e
  }
  await startSession({ uid, role: 'presswala', name: b.name })
  redirect('/p')
}

export async function logout() {
  await endSession()
  redirect('/login')
}
