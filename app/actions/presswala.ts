'use server'
import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'
import { sql } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { computeBill, money } from '@/lib/billing'
import { getSettings, priceList } from '@/lib/data'
import { todayIST } from '@/lib/dates'
import type { FormState } from './auth'
import { int, num, str } from './util'

export async function acceptOrders(fd: FormData) {
  const s = await requireRole('presswala')
  const ids = fd.getAll('order_id').map(Number).filter(Boolean)
  await sql`
    UPDATE orders SET status = 'accepted'
    WHERE presswala_id = ${s.uid} AND status = 'requested' AND id = ANY(${ids}::bigint[])`
  refresh()
}

export async function declineOrder(fd: FormData) {
  const s = await requireRole('presswala')
  const reason = str(fd, 'reason', 200) || 'Declined by presswala'
  await sql`
    UPDATE orders SET status = 'cancelled', cancelled_at = now(), notes = notes || ${' [' + reason + ']'}
    WHERE id = ${int(fd, 'order_id')} AND presswala_id = ${s.uid} AND status IN ('requested', 'accepted')`
  refresh()
}

/**
 * Records the actual pieces collected and bills the order. Can be re-run to correct counts
 * until the order is delivered; subscription pieces and the khata charge are recalculated.
 */
export async function recordPickup(_: FormState, fd: FormData): Promise<FormState> {
  const s = await requireRole('presswala')
  const orderId = int(fd, 'order_id')
  const prices = await priceList(s.uid, false)
  const lines = prices
    .map((p) => ({ code: p.code, name: p.name, unitPrice: p.price, isRegular: p.is_regular, qty: Math.max(0, int(fd, `qty_${p.id}`)) }))
    .filter((l) => l.qty > 0)
  if (!lines.length) return { error: 'Enter how many clothes you collected.' }
  if (lines.some((l) => l.qty > 500)) return { error: 'That count looks too high.' }
  const { commissionPct } = await getSettings()

  const result = await sql.begin(async (tx) => {
    const [o] = await tx<{ id: number; customer_id: number; status: string; subscription_id: number | null; subscription_pieces: number }[]>`
      SELECT id, customer_id, status, subscription_id, subscription_pieces FROM orders
      WHERE id = ${orderId} AND presswala_id = ${s.uid} AND status IN ('requested', 'accepted', 'picked_up', 'ready')
      FOR UPDATE`
    if (!o) return 'missing'

    // Give back pieces from a previous count before recalculating.
    if (o.subscription_id && o.subscription_pieces) {
      await tx`UPDATE subscriptions SET pieces_used = pieces_used - ${o.subscription_pieces} WHERE id = ${o.subscription_id}`
    }
    const [sub] = await tx<{ id: number; remaining: number }[]>`
      SELECT id, pieces_total - pieces_used AS remaining FROM subscriptions
      WHERE customer_id = ${o.customer_id} AND presswala_id = ${s.uid} AND status = 'active'
        AND end_date >= ${todayIST()}
      ORDER BY end_date LIMIT 1 FOR UPDATE`
    const bill = computeBill(lines, sub?.remaining ?? 0, commissionPct)
    if (sub && bill.subscriptionPieces) {
      await tx`UPDATE subscriptions SET pieces_used = pieces_used + ${bill.subscriptionPieces} WHERE id = ${sub.id}`
    }

    await tx`DELETE FROM order_items WHERE order_id = ${o.id}`
    for (const l of lines) {
      await tx`
        INSERT INTO order_items (order_id, code, name, qty, unit_price, is_regular)
        VALUES (${o.id}, ${l.code}, ${l.name}, ${l.qty}, ${l.unitPrice}, ${l.isRegular})`
    }
    await tx`
      UPDATE orders SET
        status = CASE WHEN status IN ('requested', 'accepted') THEN 'picked_up' ELSE status END,
        picked_up_at = COALESCE(picked_up_at, now()),
        est_pieces = ${bill.pieces}, subtotal = ${bill.subtotal}, discount = ${bill.discount}, total = ${bill.total},
        subscription_pieces = ${bill.subscriptionPieces}, subscription_id = ${bill.subscriptionPieces ? sub!.id : null},
        commission = ${bill.commission}
      WHERE id = ${o.id}`

    const note = `Order #${o.id} · ${bill.pieces} pcs${bill.subscriptionPieces ? ` (${bill.subscriptionPieces} on plan)` : ''}`
    await tx`
      INSERT INTO ledger_entries (customer_id, presswala_id, kind, amount, order_id, note, created_by)
      VALUES (${o.customer_id}, ${s.uid}, 'charge', ${bill.total}, ${o.id}, ${note}, ${s.uid})
      ON CONFLICT (order_id) WHERE kind = 'charge' AND order_id IS NOT NULL
      DO UPDATE SET amount = EXCLUDED.amount, note = EXCLUDED.note`
    return 'ok'
  })
  if (result === 'missing') return { error: 'Order not found or already delivered.' }
  refresh()
  return { ok: 'Saved. Bill added to khata.' }
}

export async function setStatus(fd: FormData) {
  const s = await requireRole('presswala')
  const id = int(fd, 'order_id')
  const to = str(fd, 'status')
  if (to === 'ready') {
    await sql`UPDATE orders SET status = 'ready', ready_at = now() WHERE id = ${id} AND presswala_id = ${s.uid} AND status = 'picked_up'`
  } else if (to === 'delivered') {
    await sql`
      UPDATE orders SET status = 'delivered', delivered_at = now(), ready_at = COALESCE(ready_at, now())
      WHERE id = ${id} AND presswala_id = ${s.uid} AND status IN ('picked_up', 'ready')`
  }
  refresh()
}

export async function markAllReady() {
  const s = await requireRole('presswala')
  await sql`UPDATE orders SET status = 'ready', ready_at = now() WHERE presswala_id = ${s.uid} AND status = 'picked_up'`
  refresh()
}

async function ownsCustomer(presswalaId: number, customerId: number) {
  const [r] = await sql`
    SELECT 1 FROM households WHERE user_id = ${customerId} AND presswala_id = ${presswalaId}
    UNION SELECT 1 FROM ledger_entries WHERE customer_id = ${customerId} AND presswala_id = ${presswalaId} LIMIT 1`
  return !!r
}

export async function recordPayment(fd: FormData) {
  const s = await requireRole('presswala')
  const customerId = int(fd, 'customer_id')
  const amount = money(num(fd, 'amount') ?? 0)
  if (amount <= 0 || amount > 100000 || !(await ownsCustomer(s.uid, customerId))) return
  await sql`
    INSERT INTO ledger_entries (customer_id, presswala_id, kind, amount, method, note, created_by)
    VALUES (${customerId}, ${s.uid}, 'payment', ${amount}, ${str(fd, 'method') === 'upi' ? 'upi' : 'cash'},
            ${str(fd, 'note', 100) || 'Payment received'}, ${s.uid})`
  refresh()
}

export async function reviewPayment(fd: FormData) {
  const s = await requireRole('presswala')
  const id = int(fd, 'entry_id')
  if (str(fd, 'decision') === 'confirm') {
    await sql`UPDATE ledger_entries SET confirmed = TRUE WHERE id = ${id} AND presswala_id = ${s.uid} AND kind = 'payment'`
  } else {
    await sql`DELETE FROM ledger_entries WHERE id = ${id} AND presswala_id = ${s.uid} AND kind = 'payment' AND NOT confirmed`
  }
  refresh()
}

export async function updateShop(_: FormState, fd: FormData): Promise<FormState> {
  const s = await requireRole('presswala')
  const days = [...new Set(fd.getAll('working_days').map(Number))].filter((d) => d >= 0 && d <= 6).sort()
  if (!days.length) return { error: 'Pick at least one working day.' }
  const areaIds = fd.getAll('area_ids').map(Number).filter(Boolean)
  if (!areaIds.length) return { error: 'Keep at least one sector / society.' }
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

  await sql.begin(async (tx) => {
    await tx`
      UPDATE presswalas SET
        shop_name = ${str(fd, 'shop_name') || 'My press'}, shop_address = ${str(fd, 'shop_address')},
        upi_id = ${str(fd, 'upi_id')},
        capacity_homes = ${clamp(int(fd, 'capacity_homes', 100), 1, 500)},
        daily_piece_capacity = ${clamp(int(fd, 'daily_piece_capacity', 300), 10, 3000)},
        slot_capacity = ${clamp(int(fd, 'slot_capacity', 12), 1, 100)},
        working_days = ${days}, accepting = ${fd.get('accepting') === 'on'},
        lat = COALESCE(${num(fd, 'lat')}, lat), lng = COALESCE(${num(fd, 'lng')}, lng)
      WHERE user_id = ${s.uid}`
    await tx`DELETE FROM presswala_areas WHERE presswala_id = ${s.uid} AND NOT (area_id = ANY(${areaIds}::bigint[]))`
    await tx`
      INSERT INTO presswala_areas (presswala_id, area_id)
      SELECT ${s.uid}, id FROM areas WHERE id = ANY(${areaIds}::bigint[]) AND active
      ON CONFLICT DO NOTHING`
  })
  refresh()
  return { ok: 'Saved.' }
}

export async function updatePrices(_: FormState, fd: FormData): Promise<FormState> {
  const s = await requireRole('presswala')
  const items = await priceList(s.uid, false)
  for (const it of items) {
    const price = num(fd, `price_${it.id}`)
    if (price == null || price < 0 || price > 5000) continue
    await sql`
      UPDATE price_items SET price = ${money(price)}, active = ${fd.get(`active_${it.id}`) === 'on'}
      WHERE id = ${it.id} AND presswala_id = ${s.uid}`
  }
  const newName = str(fd, 'new_name', 80)
  const newPrice = num(fd, 'new_price')
  if (newName && newPrice != null && newPrice >= 0) {
    const code = newName.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30) + '_' + Date.now().toString(36)
    await sql`
      INSERT INTO price_items (presswala_id, code, name, price, sort_order)
      VALUES (${s.uid}, ${code}, ${newName}, ${money(newPrice)}, 100)`
  }
  refresh()
  return { ok: 'Rates saved.' }
}

export async function goToDate(fd: FormData) {
  await requireRole('presswala')
  redirect(`/p?date=${encodeURIComponent(str(fd, 'date'))}`)
}
