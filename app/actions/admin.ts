'use server'
import { refresh } from 'next/cache'
import { sql } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { money } from '@/lib/billing'
import type { FormState } from './auth'
import { int, num, str } from './util'

export async function addArea(_: FormState, fd: FormData): Promise<FormState> {
  await requireRole('admin')
  const name = str(fd, 'name', 100)
  if (name.length < 2) return { error: 'Enter the sector / society name.' }
  const r = await sql`
    INSERT INTO areas (name, locality, lat, lng) VALUES (${name}, ${str(fd, 'locality', 100)}, ${num(fd, 'lat')}, ${num(fd, 'lng')})
    ON CONFLICT (name, city) DO NOTHING`
  if (!r.count) return { error: 'That area already exists.' }
  refresh()
  return { ok: `Added ${name}.` }
}

export async function toggleArea(fd: FormData) {
  await requireRole('admin')
  await sql`UPDATE areas SET active = NOT active WHERE id = ${int(fd, 'area_id')}`
  refresh()
}

export async function setVerified(fd: FormData) {
  await requireRole('admin')
  await sql`UPDATE presswalas SET verified = ${str(fd, 'verified') === '1'} WHERE user_id = ${int(fd, 'presswala_id')}`
  refresh()
}

export async function toggleUser(fd: FormData) {
  const s = await requireRole('admin')
  const id = int(fd, 'user_id')
  if (id === s.uid) return
  await sql`UPDATE users SET active = NOT active WHERE id = ${id} AND role <> 'admin'`
  refresh()
}

export async function addPlan(_: FormState, fd: FormData): Promise<FormState> {
  await requireRole('admin')
  const name = str(fd, 'name', 60)
  const pieces = int(fd, 'pieces_per_month')
  const price = num(fd, 'price') ?? -1
  if (!name || pieces <= 0 || price < 0) return { error: 'Fill in name, pieces and price.' }
  await sql`
    INSERT INTO plans (name, pieces_per_month, price, description)
    VALUES (${name}, ${pieces}, ${money(price)}, ${str(fd, 'description', 200)})`
  refresh()
  return { ok: 'Plan added.' }
}

export async function togglePlan(fd: FormData) {
  await requireRole('admin')
  await sql`UPDATE plans SET active = NOT active WHERE id = ${int(fd, 'plan_id')}`
  refresh()
}

export async function saveCommission(_: FormState, fd: FormData): Promise<FormState> {
  await requireRole('admin')
  const order = num(fd, 'commission_pct')
  const sub = num(fd, 'subscription_commission_pct')
  if (order == null || sub == null || order < 0 || order > 50 || sub < 0 || sub > 50) return { error: 'Use 0–50%.' }
  await sql`
    INSERT INTO settings (key, value) VALUES ('commission_pct', ${String(order)}), ('subscription_commission_pct', ${String(sub)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
  refresh()
  return { ok: 'Commission updated. Applies to new bills.' }
}

export async function recordSettlement(fd: FormData) {
  await requireRole('admin')
  const amount = money(num(fd, 'amount') ?? 0)
  if (amount <= 0) return
  await sql`
    INSERT INTO settlements (presswala_id, amount, note)
    VALUES (${int(fd, 'presswala_id')}, ${amount}, ${str(fd, 'note', 200)})`
  refresh()
}
