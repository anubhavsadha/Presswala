import Link from 'next/link'
import { acceptOrders, goToDate, markAllReady, setStatus } from '@/app/actions/presswala'
import { SubmitButton } from '@/components/SubmitButton'
import { Card, Empty, Notice, PageHeader, Stat, StatusBadge } from '@/components/ui'
import { requireRole } from '@/lib/auth'
import { rupees } from '@/lib/billing'
import { slotLabel, WEEKDAYS } from '@/lib/constants'
import { dayPlan, materializeSchedules, weekForecast, type StopOrder } from '@/lib/data'
import { addDays, formatDate, isValidDate, todayIST, weekday } from '@/lib/dates'
import { forecastLoad, mapsLinks, type PlannedRoute, type RouteStop } from '@/lib/optimize'

export const metadata = { title: 'Today' }

export default async function PresswalaToday({ searchParams }: PageProps<'/p'>) {
  const s = await requireRole('presswala')
  const q = await searchParams
  const date = typeof q.date === 'string' && isValidDate(q.date) ? q.date : todayIST()
  await materializeSchedules({ presswalaId: s.uid })
  const [plan, week] = await Promise.all([dayPlan(s.uid, date), weekForecast(s.uid)])
  const pw = plan.presswala!
  const forecast = forecastLoad(week, pw.daily_piece_capacity)
  const newRequests = [...plan.morning.stops, ...plan.selfDrops].filter((o) => o.status === 'requested')
  const saved = Math.max(0, plan.morning.naiveKm - plan.morning.totalKm) + Math.max(0, plan.evening.naiveKm - plan.evening.totalKm)
  const readyCount = plan.inShop.filter((o) => o.status === 'picked_up').length +
    plan.evening.stops.filter((o) => o.status === 'picked_up').length

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${formatDate(date)}'s plan`}
        subtitle="आज का काम: पहले उठाना, शाम को देना"
        action={
          <form action={goToDate} className="flex gap-1">
            <input type="date" name="date" defaultValue={date} className="input w-40 py-1.5 text-sm" />
            <button className="btn-secondary px-2 py-1.5 text-sm">Go</button>
          </form>
        }
      />
      {!pw.verified && <Notice>Your profile is waiting for verification. Customers will see you once our team approves it.</Notice>}
      {!pw.lat && <Notice tone="sky">Add your stall location in <Link href="/p/settings" className="underline">Settings</Link> so routes start from your stall.</Notice>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Pickups · उठाना" value={plan.morning.stops.length + plan.selfDrops.length} hint={`~${plan.estPieces} clothes`} />
        <Stat label="Drops · देना" value={plan.evening.stops.length + plan.selfCollects.length} />
        <Stat label="Walking route" value={`${(plan.morning.totalKm + plan.evening.totalKm).toFixed(1)} km`} hint={saved > 0.05 ? `${saved.toFixed(1)} km saved vs booking order` : 'Optimised'} />
        <Stat label="In shop" value={plan.inShop.length} hint="for other days" />
      </div>

      {newRequests.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold">{newRequests.length} new request{newRequests.length > 1 ? 's' : ''} · नए ऑर्डर</div>
              <div className="text-sm text-stone-600">Accept so customers know you are coming.</div>
            </div>
            <form action={acceptOrders}>
              {newRequests.map((o) => <input key={o.id} type="hidden" name="order_id" value={o.id} />)}
              <SubmitButton className="btn-primary">Accept all</SubmitButton>
            </form>
          </div>
        </Card>
      )}

      <RouteSection title="Morning pickups · सुबह उठाना" route={plan.morning} start={plan.start} kind="pickup" />

      {plan.selfDrops.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Customers dropping at your stall</h2>
          <div className="space-y-2">{plan.selfDrops.map((o) => <StopCard key={o.id} o={o} kind="pickup" />)}</div>
        </section>
      )}

      {readyCount > 0 && (
        <form action={markAllReady}>
          <SubmitButton className="btn-secondary w-full">✓ Mark all collected clothes as ironed ({readyCount}) · सब तैयार</SubmitButton>
        </form>
      )}

      <RouteSection title="Evening drops · शाम को देना" route={plan.evening} start={plan.start} kind="drop" />

      {plan.selfCollects.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Customers collecting from your stall</h2>
          <div className="space-y-2">{plan.selfCollects.map((o) => <StopCard key={o.id} o={o} kind="drop" />)}</div>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-semibold">Next 7 days · अगले 7 दिन</h2>
        <Card>
          <div className="flex items-end gap-2">
            {forecast.map((d) => {
              const pct = Math.min(100, (d.pieces / Math.max(pw.daily_piece_capacity, 1)) * 100)
              return (
                <Link key={d.date} href={`/p?date=${d.date}`} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-xs font-semibold">{d.pieces}</span>
                  <div className="flex h-24 w-full items-end rounded-md bg-stone-100">
                    <div className={`w-full rounded-md ${d.overCapacity ? 'bg-red-500' : 'bg-brand-500'}`} style={{ height: `${Math.max(pct, 3)}%` }} />
                  </div>
                  <span className={`text-xs ${d.date === date ? 'font-bold text-brand-700' : 'text-stone-500'}`}>{WEEKDAYS[weekday(d.date)]}</span>
                </Link>
              )
            })}
          </div>
          <p className="mt-2 text-xs text-stone-500">
            Expected clothes per day from bookings and weekly schedules. Your daily capacity is {pw.daily_piece_capacity}.
            {forecast.some((d) => d.overCapacity) && ' Red days are over capacity: consider getting help or pausing new customers.'}
          </p>
        </Card>
      </section>

      <div className="flex justify-between text-sm">
        <Link href={`/p?date=${addDays(date, -1)}`} className="text-brand-700">← {formatDate(addDays(date, -1))}</Link>
        <Link href={`/p?date=${addDays(date, 1)}`} className="text-brand-700">{formatDate(addDays(date, 1))} →</Link>
      </div>
    </div>
  )
}

function RouteSection({ title, route, start, kind }: {
  title: string; route: PlannedRoute<StopOrder & RouteStop>; start: { lat: number; lng: number } | null; kind: 'pickup' | 'drop'
}) {
  const links = mapsLinks(start, route.stops)
  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        {links.length > 0 && (
          <div className="flex gap-2">
            {links.map((l, i) => (
              <a key={l} href={l} target="_blank" rel="noreferrer" className="btn-secondary px-3 py-1.5 text-xs">
                🧭 Open in Maps{links.length > 1 ? ` (part ${i + 1})` : ''}
              </a>
            ))}
          </div>
        )}
      </div>
      {route.stops.length === 0 ? (
        <Empty>{kind === 'pickup' ? 'No doorstep pickups.' : 'No doorstep drops.'}</Empty>
      ) : (
        <div className="space-y-2">
          {route.stops.map((o, i) => {
            const slot = kind === 'pickup' ? o.pickup_slot : o.return_slot
            const prevSlot = i > 0 ? (kind === 'pickup' ? route.stops[i - 1].pickup_slot : route.stops[i - 1].return_slot) : null
            return (
              <div key={o.id}>
                {slot !== prevSlot && <div className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-stone-500">{slotLabel(slot)}</div>}
                <StopCard o={o} kind={kind} seq={o.seq} legKm={o.legKm} />
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function StopCard({ o, kind, seq, legKm }: { o: StopOrder; kind: 'pickup' | 'drop'; seq?: number; legKm?: number }) {
  return (
    <div className="card flex items-start gap-3 p-3">
      {seq != null && <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">{seq}</span>}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{o.address}</span>
          <StatusBadge status={o.status} hindi />
        </div>
        <div className="text-sm text-stone-600">
          {o.customer_name} · {o.area_name}{o.landmark && ` · ${o.landmark}`}
        </div>
        <div className="text-xs text-stone-500">
          {kind === 'pickup' ? `~${o.est_pieces} clothes` : `${o.est_pieces} clothes · ${rupees(o.total)}`}
          {o.source === 'schedule' && ' · weekly'}
          {legKm ? ` · ${legKm < 1 ? Math.round(legKm * 1000) + ' m' : legKm.toFixed(1) + ' km'} from last stop` : ''}
          {o.lat == null && ' · no location'}
        </div>
        {o.notes && <div className="mt-1 text-xs text-amber-800">📝 {o.notes}</div>}
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        <a href={`tel:${o.phone}`} className="btn-secondary px-3 py-1.5 text-xs">📞 Call</a>
        {kind === 'pickup' ? (
          <Link href={`/p/orders/${o.id}`} className="btn-primary px-3 py-1.5 text-xs">Count · गिनें</Link>
        ) : (
          <form action={setStatus}>
            <input type="hidden" name="order_id" value={o.id} />
            <input type="hidden" name="status" value="delivered" />
            <SubmitButton className="btn-primary w-full px-3 py-1.5 text-xs">Delivered</SubmitButton>
          </form>
        )}
      </div>
    </div>
  )
}
