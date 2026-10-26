import Link from 'next/link'
import { redirect } from 'next/navigation'
import { nudge } from '@/app/actions/customer'
import { SubmitButton } from '@/components/SubmitButton'
import { Card, Notice, StatusBadge } from '@/components/ui'
import { requireRole } from '@/lib/auth'
import { rupees, upiLink } from '@/lib/billing'
import { slotLabel, WEEKDAYS } from '@/lib/constants'
import { activeSubscription, balance, getHousehold, getPresswala, materializeSchedules } from '@/lib/data'
import { formatDate, todayIST } from '@/lib/dates'
import { sql } from '@/lib/db'

export default async function CustomerHome({ searchParams }: PageProps<'/c'>) {
  const s = await requireRole('customer')
  const q = await searchParams
  const h = await getHousehold(s.uid)
  if (!h) redirect('/login')
  if (!h.presswala_id) redirect('/c/presswala')

  await materializeSchedules({ customerId: s.uid })
  const [pw, sub, bal, schedule, open] = await Promise.all([
    getPresswala(h.presswala_id),
    activeSubscription(s.uid),
    balance(s.uid, h.presswala_id),
    sql<{ weekdays: number[]; pickup_slot: string; return_slot: string }[]>`
      SELECT weekdays, pickup_slot, return_slot FROM schedules WHERE customer_id = ${s.uid} AND active`.then((r) => r[0]),
    sql<{ id: number; status: string; service_date: string; pickup_slot: string; pickup_mode: string; return_date: string; return_slot: string; return_mode: string; est_pieces: number; total: number }[]>`
      SELECT id, status, service_date, pickup_slot, pickup_mode, return_date, return_slot, return_mode, est_pieces, total
      FROM orders WHERE customer_id = ${s.uid} AND status IN ('requested', 'accepted', 'picked_up', 'ready')
        AND (status IN ('picked_up', 'ready') OR service_date >= ${todayIST()})
      ORDER BY service_date, pickup_slot LIMIT 5`,
  ])
  if (!pw) redirect('/c/presswala')

  return (
    <div className="space-y-4">
      {q.subscribed && <Notice tone="green">Plan activated. Pay your presswala the plan amount from the Khata tab.</Notice>}
      {q.nudge === 'full' && <Notice>Your presswala is fully booked for the next few days. Try booking a slot manually.</Notice>}

      <Card className="bg-gradient-to-br from-brand-600 to-brand-700 text-white">
        <div className="text-sm opacity-90">Namaste, {s.name.split(' ')[0]} 👋</div>
        <div className="mt-1 text-lg font-bold">Need clothes ironed?</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <form action={nudge}>
            <SubmitButton className="btn w-full bg-white py-3 text-brand-700 hover:bg-brand-50" pendingText="Booking…">
              🔔 Pick up soon
            </SubmitButton>
          </form>
          <Link href="/c/book" className="btn w-full border border-white/40 py-3 text-white hover:bg-white/10">📅 Choose slot</Link>
        </div>
        <p className="mt-2 text-xs opacity-80">“Pick up soon” books the next best slot automatically, when {pw.name.split(' ')[0]} is already near you.</p>
      </Card>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Upcoming</h2>
          <Link href="/c/orders" className="text-sm text-brand-700">All orders</Link>
        </div>
        {open.length === 0 ? (
          <Card><p className="text-sm text-stone-500">Nothing scheduled. Book a pickup or set a weekly schedule.</p></Card>
        ) : (
          <div className="space-y-2">
            {open.map((o) => (
              <Link key={o.id} href={`/c/orders/${o.id}`} className="card flex items-center justify-between gap-3 hover:border-brand-200">
                <div className="min-w-0">
                  <div className="font-medium">
                    {o.status === 'picked_up' || o.status === 'ready'
                      ? `Back ${formatDate(o.return_date)}, ${o.return_mode === 'doorstep' ? slotLabel(o.return_slot) : 'collect from shop'}`
                      : `${o.pickup_mode === 'doorstep' ? 'Pickup' : 'Drop at shop'} ${formatDate(o.service_date)}, ${slotLabel(o.pickup_slot)}`}
                  </div>
                  <div className="text-xs text-stone-500">Order #{o.id} · ~{o.est_pieces} pcs{o.total ? ` · ${rupees(o.total)}` : ''}</div>
                </div>
                <StatusBadge status={o.status} />
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <div className="text-xs font-medium uppercase text-stone-500">Your presswala</div>
          <div className="mt-1 font-semibold">{pw.name}</div>
          <div className="text-sm text-stone-500">{pw.shop_name}{pw.shop_address && ` · ${pw.shop_address}`}</div>
          <div className="mt-1 text-sm">
            {pw.rating_count ? `★ ${(pw.rating_sum / pw.rating_count).toFixed(1)} (${pw.rating_count})` : 'New'} ·{' '}
            <a href={`tel:${pw.phone}`} className="text-brand-700">Call</a>
          </div>
          <Link href="/c/presswala" className="mt-2 inline-block text-xs text-stone-500 underline">Change presswala</Link>
        </Card>

        <Card>
          <div className="text-xs font-medium uppercase text-stone-500">Khata balance</div>
          <div className={`mt-1 text-2xl font-bold ${bal.owed > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {bal.owed > 0 ? rupees(bal.owed) : bal.owed < 0 ? `${rupees(-bal.owed)} advance` : 'All clear'}
          </div>
          {bal.pending > 0 && <div className="text-xs text-amber-700">{rupees(bal.pending)} waiting for confirmation</div>}
          <div className="mt-2 flex gap-2">
            {bal.owed > 0 && pw.upi_id && (
              <a href={upiLink(pw.upi_id, pw.name, bal.owed, 'Presswala khata')} className="btn-primary px-3 py-1.5 text-xs">Pay by UPI</a>
            )}
            <Link href="/c/khata" className="btn-secondary px-3 py-1.5 text-xs">View khata</Link>
          </div>
        </Card>

        <Card>
          <div className="text-xs font-medium uppercase text-stone-500">Weekly schedule</div>
          {schedule ? (
            <>
              <div className="mt-1 font-semibold">{schedule.weekdays.map((d) => WEEKDAYS[d]).join(', ')}</div>
              <div className="text-sm text-stone-500">Pickup {slotLabel(schedule.pickup_slot)} · back {slotLabel(schedule.return_slot)}</div>
            </>
          ) : (
            <p className="mt-1 text-sm text-stone-500">Set it once and your presswala comes on fixed days, no booking needed.</p>
          )}
          <Link href="/c/schedule" className="mt-2 inline-block text-sm font-medium text-brand-700">{schedule ? 'Edit' : 'Set schedule'} →</Link>
        </Card>

        <Card>
          <div className="text-xs font-medium uppercase text-stone-500">Monthly plan</div>
          {sub ? (
            <>
              <div className="mt-1 font-semibold">{sub.plan_name}: {sub.pieces_total - sub.pieces_used} of {sub.pieces_total} pieces left</div>
              <div className="mt-2 h-2 rounded-full bg-stone-100">
                <div className="h-2 rounded-full bg-brand-500" style={{ width: `${Math.min(100, (sub.pieces_used / sub.pieces_total) * 100)}%` }} />
              </div>
              <div className="mt-1 text-xs text-stone-500">Valid till {formatDate(sub.end_date)}</div>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-stone-500">Save on regular clothes with a prepaid monthly plan, from ₹5 a piece.</p>
              <Link href="/c/plans" className="mt-2 inline-block text-sm font-medium text-brand-700">See plans →</Link>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
