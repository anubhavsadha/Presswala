'use server'
import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'
import { sql } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { PICKUP_SLOTS, RETURN_SLOTS } from '@/lib/constants'
import { addDays, isValidDate, todayIST, weekday } from '@/lib/dates'
import { money } from '@/lib/billing'
import {
  activeSubscription, bestSlotToday, getHousehold, getPresswala, getSettings, materializeSchedules,
  presswalasForArea, servesArea, slotAdvice,
} from '@/lib/data'
import type { FormState } from './auth'
import { int, num, str } from './util'

const pickupIds = PICKUP_SLOTS.map((s) => s.id)
const returnIds = RETURN_SLOTS.map((s) => s.id)

async function linkedHousehold() {
  const s = await requireRole('customer')
  const h = await getHousehold(s.uid)
  if (!h) redirect('/login')
  return { s, h }
}

export async function choosePresswala(fd: FormData) {
  const { s, h } = await linkedHousehold()
  const pid = int(fd, 'presswala_id')
  const options = await presswalasForArea(h.area_id, null)
  const pick = options.find((p) => p.id === pid)
  if (!pick || (pick.full && h.presswala_id !== pid)) redirect('/c/presswala?error=unavailable')

  await sql.begin(async (tx) => {
    await tx`UPDATE households SET presswala_id = ${pid}, linked_at = now() WHERE user_id = ${s.uid}`
    // A recurring schedule belongs to one presswala; move it across.
    await tx`UPDATE schedules SET presswala_id = ${pid} WHERE customer_id = ${s.uid} AND active`
    await tx`
      UPDATE orders SET status = 'cancelled', cancelled_at = now()
      WHERE customer_id = ${s.uid} AND presswala_id <> ${pid} AND status IN ('requested', 'accepted')`
  })
  redirect('/c')
}

export async function bookPickup(_: FormState, fd: FormData): Promise<FormState> {
  const { s, h } = await linkedHousehold()
  if (!h.presswala_id) return { error: 'Choose your presswala first.' }
  const pw = await getPresswala(h.presswala_id)
  if (!pw) return { error: 'Your presswala is unavailable. Choose another.' }

  const date = str(fd, 'service_date')
  const pickupMode = str(fd, 'pickup_mode') === 'self_drop' ? 'self_drop' : 'doorstep'
  const pickupSlot = str(fd, 'pickup_slot')
  const returnMode = str(fd, 'return_mode') === 'self_collect' ? 'self_collect' : 'doorstep'
  const returnSlot = str(fd, 'return_slot')
  const returnNextDay = str(fd, 'return_day') === 'next'
  const est = Math.max(1, Math.min(200, int(fd, 'est_pieces', 10)))

  const today = todayIST()
  if (!isValidDate(date) || date < today || date > addDays(today, 14)) return { error: 'Pick a date within the next two weeks.' }
  if (!pw.working_days.includes(weekday(date))) return { error: 'Your presswala is closed on that day. Pick another day.' }
  if (!pickupIds.includes(pickupSlot)) return { error: 'Pick a time slot.' }
  if (!returnIds.includes(returnSlot)) return { error: 'Pick when you will be home to receive clothes.' }

  if (pickupMode === 'doorstep') {
    const advice = await slotAdvice(pw.user_id, date, h.area_id)
    if (advice.find((a) => a.slot === pickupSlot)?.full) return { error: 'That slot just filled up or has passed. Pick another.' }
  }
  const [dupe] = await sql`
    SELECT id FROM orders WHERE customer_id = ${s.uid} AND service_date = ${date} AND status IN ('requested', 'accepted')`
  if (dupe) return { error: 'You already have a pickup that day. Edit or cancel it from Orders.' }

  let returnDate = returnNextDay ? addDays(date, 1) : date
  // Ironing needs a few hours; a late pickup can't come back the same evening.
  if (!returnNextDay && pickupSlot === '11-13' && returnSlot === '16-18') returnDate = addDays(date, 1)

  const [o] = await sql<{ id: number }[]>`
    INSERT INTO orders (customer_id, presswala_id, area_id, source, service_date, pickup_mode, pickup_slot,
                        return_mode, return_date, return_slot, est_pieces, notes, status)
    VALUES (${s.uid}, ${pw.user_id}, ${h.area_id}, 'booking', ${date}, ${pickupMode}, ${pickupSlot},
            ${returnMode}, ${returnDate}, ${returnSlot}, ${est}, ${str(fd, 'notes', 300)}, 'requested')
    RETURNING id`
  redirect(`/c/orders/${o.id}?booked=1`)
}

/** One-tap "please pick up today": picks the best open slot automatically. */
export async function nudge() {
  const { s, h } = await linkedHousehold()
  if (!h.presswala_id) redirect('/c/presswala')
  const pw = await getPresswala(h.presswala_id)
  if (!pw) redirect('/c/presswala')

  let date = todayIST()
  let slot = pw.working_days.includes(weekday(date)) ? await bestSlotToday(pw.user_id, h.area_id) : null
  if (!slot) {
    // Nothing left today: first working day after, best slot.
    for (let i = 1; i <= 7 && !slot; i++) {
      const d = addDays(todayIST(), i)
      if (!pw.working_days.includes(weekday(d))) continue
      const advice = await slotAdvice(pw.user_id, d, h.area_id)
      slot = advice.find((a) => a.recommended)?.slot ?? null
      if (slot) date = d
    }
  }
  if (!slot) redirect('/c?nudge=full')

  const [existing] = await sql<{ id: number }[]>`
    SELECT id FROM orders WHERE customer_id = ${s.uid} AND service_date = ${date} AND status IN ('requested', 'accepted')`
  if (existing) redirect(`/c/orders/${existing.id}`)

  const [last] = await sql<{ est_pieces: number; return_slot: string }[]>`
    SELECT est_pieces, return_slot FROM orders WHERE customer_id = ${s.uid} ORDER BY created_at DESC LIMIT 1`
  const [o] = await sql<{ id: number }[]>`
    INSERT INTO orders (customer_id, presswala_id, area_id, source, service_date, pickup_mode, pickup_slot,
                        return_mode, return_date, return_slot, est_pieces, status)
    VALUES (${s.uid}, ${pw.user_id}, ${h.area_id}, 'nudge', ${date}, 'doorstep', ${slot},
            'doorstep', ${slot === '11-13' ? addDays(date, 1) : date}, ${last?.return_slot ?? '18-20'},
            ${last?.est_pieces ?? 10}, 'requested')
    RETURNING id`
  redirect(`/c/orders/${o.id}?booked=1`)
}

export async function cancelOrder(fd: FormData) {
  const s = await requireRole('customer')
  await sql`
    UPDATE orders SET status = 'cancelled', cancelled_at = now()
    WHERE id = ${int(fd, 'order_id')} AND customer_id = ${s.uid} AND status IN ('requested', 'accepted')`
  refresh()
}

/** "I'll be home at…" — change when ironed clothes come back. */
export async function updateReturn(fd: FormData) {
  const s = await requireRole('customer')
  const slot = str(fd, 'return_slot')
  const date = str(fd, 'return_date')
  const mode = str(fd, 'return_mode') === 'self_collect' ? 'self_collect' : 'doorstep'
  if (!returnIds.includes(slot) || !isValidDate(date) || date < todayIST()) return
  await sql`
    UPDATE orders SET return_slot = ${slot}, return_date = GREATEST(${date}::date, service_date), return_mode = ${mode}
    WHERE id = ${int(fd, 'order_id')} AND customer_id = ${s.uid} AND status IN ('requested', 'accepted', 'picked_up', 'ready')`
  refresh()
}

export async function rateOrder(fd: FormData) {
  const s = await requireRole('customer')
  const rating = int(fd, 'rating')
  if (rating < 1 || rating > 5) return
  await sql.begin(async (tx) => {
    const [o] = await tx<{ presswala_id: number; old: number | null }[]>`
      SELECT presswala_id, rating AS old FROM orders
      WHERE id = ${int(fd, 'order_id')} AND customer_id = ${s.uid} AND status = 'delivered' FOR UPDATE`
    if (!o) return
    await tx`UPDATE orders SET rating = ${rating}, review = ${str(fd, 'review', 300)} WHERE id = ${int(fd, 'order_id')}`
    await tx`
      UPDATE presswalas SET rating_sum = rating_sum + ${rating} - ${o.old ?? 0},
                            rating_count = rating_count + ${o.old == null ? 1 : 0}
      WHERE user_id = ${o.presswala_id}`
  })
  refresh()
}

export async function saveSchedule(_: FormState, fd: FormData): Promise<FormState> {
  const { s, h } = await linkedHousehold()
  if (!h.presswala_id) return { error: 'Choose your presswala first.' }
  const days = [...new Set(fd.getAll('weekdays').map(Number))].filter((d) => d >= 0 && d <= 6).sort()
  const pickupSlot = str(fd, 'pickup_slot')
  const returnSlot = str(fd, 'return_slot')
  if (!days.length) return { error: 'Pick at least one day.' }
  if (!pickupIds.includes(pickupSlot) || !returnIds.includes(returnSlot)) return { error: 'Pick both time slots.' }

  await sql.begin(async (tx) => {
    const old = await tx<{ id: number }[]>`UPDATE schedules SET active = FALSE WHERE customer_id = ${s.uid} AND active RETURNING id`
    // Future orders generated by the old schedule are replaced by the new one.
    if (old.length) {
      await tx`
        UPDATE orders SET status = 'cancelled', cancelled_at = now()
        WHERE schedule_id = ANY(${old.map((o) => o.id)}::bigint[]) AND status IN ('requested', 'accepted')
          AND service_date >= ${todayIST()}`
    }
    await tx`
      INSERT INTO schedules (customer_id, presswala_id, weekdays, pickup_mode, pickup_slot, return_mode, return_slot, est_pieces)
      VALUES (${s.uid}, ${h.presswala_id}, ${days}, ${str(fd, 'pickup_mode') === 'self_drop' ? 'self_drop' : 'doorstep'},
              ${pickupSlot}, ${str(fd, 'return_mode') === 'self_collect' ? 'self_collect' : 'doorstep'}, ${returnSlot},
              ${Math.max(1, Math.min(200, int(fd, 'est_pieces', 10)))})`
  })
  await materializeSchedules({ customerId: s.uid })
  refresh()
  return { ok: 'Schedule saved. Your presswala will come on these days automatically.' }
}

export async function stopSchedule() {
  const s = await requireRole('customer')
  const old = await sql<{ id: number }[]>`UPDATE schedules SET active = FALSE WHERE customer_id = ${s.uid} AND active RETURNING id`
  if (old.length) {
    await sql`
      UPDATE orders SET status = 'cancelled', cancelled_at = now()
      WHERE schedule_id = ANY(${old.map((o) => o.id)}::bigint[]) AND status IN ('requested', 'accepted')
        AND service_date > ${todayIST()}`
  }
  refresh()
}

/** Customer says they paid by UPI/cash; stays pending until the presswala confirms it. */
export async function reportPayment(fd: FormData) {
  const { s, h } = await linkedHousehold()
  const amount = money(num(fd, 'amount') ?? 0)
  if (!h.presswala_id || amount <= 0 || amount > 100000) return
  await sql`
    INSERT INTO ledger_entries (customer_id, presswala_id, kind, amount, method, note, confirmed, created_by)
    VALUES (${s.uid}, ${h.presswala_id}, 'payment', ${amount}, ${str(fd, 'method') === 'cash' ? 'cash' : 'upi'},
            'Reported by customer', FALSE, ${s.uid})`
  refresh()
}

export async function subscribe(fd: FormData) {
  const { s, h } = await linkedHousehold()
  if (!h.presswala_id) redirect('/c/presswala')
  if (await activeSubscription(s.uid)) redirect('/c/plans?error=active')
  const [plan] = await sql<{ id: number; name: string; price: number; pieces_per_month: number }[]>`
    SELECT * FROM plans WHERE id = ${int(fd, 'plan_id')} AND active`
  if (!plan) redirect('/c/plans')
  const { subscriptionCommissionPct } = await getSettings()
  const start = todayIST()
  await sql.begin(async (tx) => {
    const [sub] = await tx<{ id: number }[]>`
      INSERT INTO subscriptions (customer_id, presswala_id, plan_id, plan_name, price, pieces_total, start_date, end_date, commission)
      VALUES (${s.uid}, ${h.presswala_id}, ${plan.id}, ${plan.name}, ${plan.price}, ${plan.pieces_per_month},
              ${start}, ${addDays(start, 29)}, ${money((plan.price * subscriptionCommissionPct) / 100)})
      RETURNING id`
    await tx`
      INSERT INTO ledger_entries (customer_id, presswala_id, kind, amount, subscription_id, note, created_by)
      VALUES (${s.uid}, ${h.presswala_id}, 'charge', ${plan.price}, ${sub.id}, ${`${plan.name} plan · ${plan.pieces_per_month} pieces`}, ${s.uid})`
  })
  redirect('/c?subscribed=1')
}

export async function updateProfile(_: FormState, fd: FormData): Promise<FormState> {
  const { s, h } = await linkedHousehold()
  const address = str(fd, 'address')
  const areaId = int(fd, 'area_id', h.area_id)
  if (address.length < 3) return { error: 'Enter your house / flat number.' }
  const [area] = await sql`SELECT id FROM areas WHERE id = ${areaId} AND active`
  if (!area) return { error: 'Choose your sector / society.' }
  const keepPresswala = h.presswala_id && (areaId === h.area_id || (await servesArea(h.presswala_id, areaId)))
  await sql`
    UPDATE households SET area_id = ${areaId}, address = ${address}, landmark = ${str(fd, 'landmark')},
      lat = COALESCE(${num(fd, 'lat')}, CASE WHEN ${areaId} = area_id THEN lat END),
      lng = COALESCE(${num(fd, 'lng')}, CASE WHEN ${areaId} = area_id THEN lng END),
      presswala_id = ${keepPresswala ? h.presswala_id : null}
    WHERE user_id = ${s.uid}`
  const name = str(fd, 'name')
  if (name.length >= 2) await sql`UPDATE users SET name = ${name} WHERE id = ${s.uid}`
  if (!keepPresswala && h.presswala_id) redirect('/c/presswala?moved=1')
  refresh()
  return { ok: 'Saved.' }
}
