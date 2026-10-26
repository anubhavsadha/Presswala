import 'server-only'
import { sql } from './db'
import { PICKUP_SLOTS, RETURN_SLOTS } from './constants'
import { addDays, currentHourIST, todayIST } from './dates'
import { adviseSlots, haversineKm, planRoute, rankPresswalas, type Point } from './optimize'

export async function getSettings() {
  const rows = await sql<{ key: string; value: string }[]>`SELECT key, value FROM settings`
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return {
    commissionPct: Number(m.commission_pct ?? 10),
    subscriptionCommissionPct: Number(m.subscription_commission_pct ?? 8),
  }
}

export async function listAreas(activeOnly = true) {
  return sql<{ id: number; name: string; locality: string; lat: number | null; lng: number | null; active: boolean }[]>`
    SELECT id, name, locality, lat, lng, active FROM areas
    WHERE ${activeOnly ? sql`active` : sql`TRUE`} ORDER BY name`
}

export type Household = {
  user_id: number; name: string; phone: string; area_id: number; area_name: string; address: string
  landmark: string; lat: number | null; lng: number | null; presswala_id: number | null
  area_lat: number | null; area_lng: number | null
}

export async function getHousehold(customerId: number) {
  const [h] = await sql<Household[]>`
    SELECT h.*, u.name, u.phone, a.name AS area_name, a.lat AS area_lat, a.lng AS area_lng
    FROM households h JOIN users u ON u.id = h.user_id JOIN areas a ON a.id = h.area_id
    WHERE h.user_id = ${customerId}`
  return h ?? null
}

export type PresswalaRow = {
  user_id: number; name: string; phone: string; shop_name: string; shop_address: string
  lat: number | null; lng: number | null; upi_id: string; capacity_homes: number
  daily_piece_capacity: number; slot_capacity: number; working_days: number[]
  verified: boolean; accepting: boolean; rating_sum: number; rating_count: number; linked_homes: number
}

const presswalaSelect = sql`
  SELECT p.*, u.name, u.phone,
         (SELECT count(*)::int FROM households h WHERE h.presswala_id = p.user_id) AS linked_homes
  FROM presswalas p JOIN users u ON u.id = p.user_id`

export async function getPresswala(id: number) {
  const [p] = await sql<PresswalaRow[]>`${presswalaSelect} WHERE p.user_id = ${id}`
  return p ?? null
}

export async function presswalaAreas(id: number) {
  return sql<{ id: number; name: string }[]>`
    SELECT a.id, a.name FROM presswala_areas pa JOIN areas a ON a.id = pa.area_id
    WHERE pa.presswala_id = ${id} ORDER BY a.name`
}

export async function priceList(presswalaId: number, activeOnly = true) {
  return sql<{ id: number; code: string; name: string; price: number; is_regular: boolean; active: boolean }[]>`
    SELECT id, code, name, price, is_regular, active FROM price_items
    WHERE presswala_id = ${presswalaId} AND ${activeOnly ? sql`active` : sql`TRUE`}
    ORDER BY sort_order, id`
}

/** The only presswalas a customer may see: verified, accepting, and serving their area. */
export async function presswalasForArea(areaId: number, home: Point | null) {
  const rows = await sql<PresswalaRow[]>`
    ${presswalaSelect}
    JOIN presswala_areas pa ON pa.presswala_id = p.user_id AND pa.area_id = ${areaId}
    WHERE p.verified AND p.accepting AND u.active`
  return rankPresswalas(rows.map((p) => ({
    ...p,
    id: p.user_id,
    capacityHomes: p.capacity_homes,
    linkedHomes: p.linked_homes,
    ratingSum: p.rating_sum,
    ratingCount: p.rating_count,
    distanceKm: home && p.lat != null && p.lng != null ? Math.round(haversineKm(home, p as Point) * 10) / 10 : null,
  })))
}

export async function servesArea(presswalaId: number, areaId: number) {
  const [r] = await sql`
    SELECT 1 FROM presswala_areas pa JOIN presswalas p ON p.user_id = pa.presswala_id
    WHERE pa.presswala_id = ${presswalaId} AND pa.area_id = ${areaId} AND p.verified`
  return !!r
}

export async function activeSubscription(customerId: number) {
  await sql`
    UPDATE subscriptions SET status = 'expired'
    WHERE customer_id = ${customerId} AND status = 'active' AND end_date < ${todayIST()}`
  const [s] = await sql<{
    id: number; plan_name: string; pieces_total: number; pieces_used: number; end_date: string
    start_date: string; presswala_id: number; price: number
  }[]>`
    SELECT * FROM subscriptions WHERE customer_id = ${customerId} AND status = 'active'
    ORDER BY end_date DESC LIMIT 1`
  return s ?? null
}

export async function balance(customerId: number, presswalaId: number) {
  const [r] = await sql<{ owed: number; pending: number }[]>`
    SELECT
      COALESCE(sum(CASE WHEN kind = 'charge' THEN amount WHEN confirmed THEN -amount ELSE 0 END), 0)::float AS owed,
      COALESCE(sum(CASE WHEN kind = 'payment' AND NOT confirmed THEN amount ELSE 0 END), 0)::float AS pending
    FROM ledger_entries WHERE customer_id = ${customerId} AND presswala_id = ${presswalaId}`
  return r
}

export async function ledger(customerId: number, presswalaId: number) {
  return sql<{
    id: number; kind: 'charge' | 'payment'; amount: number; method: string; note: string
    confirmed: boolean; order_id: number | null; created_at: Date
  }[]>`
    SELECT id, kind, amount, method, note, confirmed, order_id, created_at FROM ledger_entries
    WHERE customer_id = ${customerId} AND presswala_id = ${presswalaId}
    ORDER BY created_at DESC, id DESC LIMIT 200`
}

/** Turns recurring schedules into concrete orders for the next `days` days. Idempotent. */
export async function materializeSchedules(scope: { presswalaId?: number; customerId?: number }, days = 7) {
  const start = todayIST()
  const hour = currentHourIST()
  // One set-based insert: every (schedule, day) in the window that falls on a chosen weekday and a
  // presswala working day, skipping slots that already started today and days the customer has
  // booked manually. Existing rows (including ones the customer cancelled) are never recreated.
  const r = await sql`
    INSERT INTO orders (customer_id, presswala_id, area_id, schedule_id, source, service_date, pickup_mode,
                        pickup_slot, return_mode, return_date, return_slot, est_pieces, status)
    SELECT s.customer_id, s.presswala_id, h.area_id, s.id, 'schedule', d::date, s.pickup_mode,
           s.pickup_slot, s.return_mode, d::date, s.return_slot, s.est_pieces, 'accepted'
    FROM schedules s
    JOIN households h ON h.user_id = s.customer_id AND h.presswala_id = s.presswala_id
    JOIN presswalas p ON p.user_id = s.presswala_id
    CROSS JOIN generate_series(${start}::date, ${start}::date + ${days - 1}::int, interval '1 day') AS d
    WHERE s.active
      AND ${scope.presswalaId ? sql`s.presswala_id = ${scope.presswalaId}` : sql`TRUE`}
      AND ${scope.customerId ? sql`s.customer_id = ${scope.customerId}` : sql`TRUE`}
      AND extract(dow FROM d)::int = ANY(s.weekdays)
      AND extract(dow FROM d)::int = ANY(p.working_days)
      AND NOT (d::date = ${start}::date AND split_part(s.pickup_slot, '-', 1)::numeric <= ${hour}::numeric)
      AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.schedule_id = s.id AND o.service_date = d::date)
      AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = s.customer_id AND o.service_date = d::date
                        AND o.status <> 'cancelled')
    ON CONFLICT (schedule_id, service_date) WHERE schedule_id IS NOT NULL DO NOTHING`
  return r.count
}

export async function slotAdvice(presswalaId: number, date: string, areaId: number) {
  const p = await getPresswala(presswalaId)
  if (!p) return []
  const bookings = await sql<{ slot: string; areaId: number }[]>`
    SELECT pickup_slot AS slot, area_id AS "areaId" FROM orders
    WHERE presswala_id = ${presswalaId} AND service_date = ${date}
      AND pickup_mode = 'doorstep' AND status <> 'cancelled'`
  const hour = currentHourIST()
  const closed = date === todayIST() ? PICKUP_SLOTS.filter((s) => s.start - 0.5 <= hour).map((s) => s.id) : []
  return adviseSlots(PICKUP_SLOTS.map((s) => s.id), bookings, areaId, p.slot_capacity, closed)
}

/** Slot whose window has not started yet, preferring clustered ones. Used by the "pick up today" nudge. */
export async function bestSlotToday(presswalaId: number, areaId: number) {
  const advice = await slotAdvice(presswalaId, todayIST(), areaId)
  return advice.find((a) => a.recommended)?.slot ?? null
}

export type StopOrder = {
  id: number; customer_id: number; customer_name: string; phone: string; address: string; landmark: string
  area_name: string; lat: number | null; lng: number | null; pickup_mode: string; pickup_slot: string
  return_mode: string; return_slot: string; status: string; est_pieces: number; total: number
  notes: string; source: string; service_date: string; return_date: string
}

const stopSelect = sql`
  SELECT o.id, o.customer_id, u.name AS customer_name, u.phone, h.address, h.landmark, a.name AS area_name,
         COALESCE(h.lat, a.lat) AS lat, COALESCE(h.lng, a.lng) AS lng,
         o.pickup_mode, o.pickup_slot, o.return_mode, o.return_slot, o.status, o.est_pieces, o.total,
         o.notes, o.source, o.service_date, o.return_date
  FROM orders o JOIN users u ON u.id = o.customer_id JOIN households h ON h.user_id = o.customer_id
  JOIN areas a ON a.id = o.area_id`

/** Everything a presswala has to do on a date, with the optimised walking route. */
export async function dayPlan(presswalaId: number, date: string) {
  const p = await getPresswala(presswalaId)
  const pickups = await sql<StopOrder[]>`
    ${stopSelect} WHERE o.presswala_id = ${presswalaId} AND o.service_date = ${date}
      AND o.status IN ('requested', 'accepted') ORDER BY o.created_at`
  const drops = await sql<StopOrder[]>`
    ${stopSelect} WHERE o.presswala_id = ${presswalaId} AND o.return_date = ${date}
      AND o.status IN ('picked_up', 'ready') ORDER BY o.created_at`
  const inShop = await sql<StopOrder[]>`
    ${stopSelect} WHERE o.presswala_id = ${presswalaId} AND o.status IN ('picked_up', 'ready')
      AND o.return_date <> ${date} ORDER BY o.return_date, o.return_slot`

  const start = p?.lat != null && p?.lng != null ? { lat: p.lat, lng: p.lng } : null
  const pickupIdx = (id: string) => PICKUP_SLOTS.findIndex((s) => s.id === id)
  const returnIdx = (id: string) => RETURN_SLOTS.findIndex((s) => s.id === id)

  const morning = planRoute(start, pickups.filter((o) => o.pickup_mode === 'doorstep')
    .map((o) => ({ ...o, kind: 'pickup' as const, window: pickupIdx(o.pickup_slot) })))
  const evening = planRoute(start, drops.filter((o) => o.return_mode === 'doorstep')
    .map((o) => ({ ...o, kind: 'drop' as const, window: returnIdx(o.return_slot) })))

  return {
    presswala: p,
    start,
    morning,
    evening,
    selfDrops: pickups.filter((o) => o.pickup_mode === 'self_drop'),
    selfCollects: drops.filter((o) => o.return_mode === 'self_collect'),
    inShop,
    estPieces: pickups.reduce((s, o) => s + o.est_pieces, 0),
  }
}

/** Expected pieces per day for the coming week, from bookings plus recurring schedules. */
export async function weekForecast(presswalaId: number) {
  const start = todayIST()
  const rows = await sql<{ date: string; pieces: number; homes: number }[]>`
    SELECT service_date AS date, sum(est_pieces)::int AS pieces, count(DISTINCT customer_id)::int AS homes
    FROM orders WHERE presswala_id = ${presswalaId} AND status <> 'cancelled'
      AND service_date BETWEEN ${start} AND ${addDays(start, 6)}
    GROUP BY service_date`
  const by = Object.fromEntries(rows.map((r) => [r.date, r]))
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i)
    return { date, pieces: by[date]?.pieces ?? 0, homes: by[date]?.homes ?? 0 }
  })
}

export async function commissionDue(presswalaId: number) {
  const [r] = await sql<{ earned: number; commission: number; settled: number }[]>`
    SELECT
      (SELECT COALESCE(sum(total), 0) FROM orders WHERE presswala_id = ${presswalaId} AND status IN ('picked_up','ready','delivered'))::float
      + (SELECT COALESCE(sum(price), 0) FROM subscriptions WHERE presswala_id = ${presswalaId} AND status <> 'cancelled')::float AS earned,
      (SELECT COALESCE(sum(commission), 0) FROM orders WHERE presswala_id = ${presswalaId} AND status IN ('picked_up','ready','delivered'))::float
      + (SELECT COALESCE(sum(commission), 0) FROM subscriptions WHERE presswala_id = ${presswalaId} AND status <> 'cancelled')::float AS commission,
      (SELECT COALESCE(sum(amount), 0) FROM settlements WHERE presswala_id = ${presswalaId})::float AS settled`
  return { ...r, due: Math.round((r.commission - r.settled) * 100) / 100 }
}
