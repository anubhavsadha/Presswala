import { Card, PageHeader, Stat } from '@/components/ui'
import { requireRole } from '@/lib/auth'
import { rupees } from '@/lib/billing'
import { commissionDue, getSettings } from '@/lib/data'
import { todayIST } from '@/lib/dates'
import { sql } from '@/lib/db'

export const metadata = { title: 'Earnings' }

export default async function Earnings() {
  const s = await requireRole('presswala')
  const monthStart = todayIST().slice(0, 8) + '01'
  const [[m], [coll], dues, settings, settlements] = await Promise.all([
    sql<{ orders: number; pieces: number; billed: number }[]>`
      SELECT count(*)::int AS orders, COALESCE(sum(est_pieces), 0)::int AS pieces, COALESCE(sum(total), 0)::float AS billed
      FROM orders WHERE presswala_id = ${s.uid} AND status IN ('picked_up', 'ready', 'delivered') AND service_date >= ${monthStart}`,
    sql<{ collected: number; outstanding: number }[]>`
      SELECT COALESCE(sum(amount) FILTER (WHERE kind = 'payment' AND confirmed AND created_at >= ${monthStart}::date), 0)::float AS collected,
             COALESCE(sum(CASE WHEN kind = 'charge' THEN amount WHEN confirmed THEN -amount ELSE 0 END), 0)::float AS outstanding
      FROM ledger_entries WHERE presswala_id = ${s.uid}`,
    commissionDue(s.uid),
    getSettings(),
    sql<{ id: number; amount: number; note: string; created_at: Date }[]>`
      SELECT id, amount, note, created_at FROM settlements WHERE presswala_id = ${s.uid} ORDER BY created_at DESC LIMIT 20`,
  ])
  return (
    <div className="space-y-4">
      <PageHeader title="Earnings · कमाई" subtitle="This month" />
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Clothes ironed" value={m.pieces} hint={`${m.orders} orders`} />
        <Stat label="Billed" value={rupees(m.billed)} />
        <Stat label="Collected" value={rupees(coll.collected)} hint="cash + UPI confirmed" />
        <Stat label="Still to collect" value={rupees(Math.max(0, coll.outstanding))} hint="all customers" />
      </div>
      <Card>
        <h2 className="font-semibold">Platform fee</h2>
        <p className="mt-1 text-sm text-stone-600">
          {settings.commissionPct}% on order bills and {settings.subscriptionCommissionPct}% on monthly plans. Settle with the Istrify team weekly.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
          <div><div className="text-xs text-stone-500">Total fee</div><div className="font-semibold">{rupees(dues.commission)}</div></div>
          <div><div className="text-xs text-stone-500">Paid</div><div className="font-semibold">{rupees(dues.settled)}</div></div>
          <div><div className="text-xs text-stone-500">Due</div><div className={`font-bold ${dues.due > 0 ? 'text-red-600' : 'text-emerald-700'}`}>{rupees(dues.due)}</div></div>
        </div>
        {settlements.length > 0 && (
          <ul className="mt-3 divide-y divide-stone-100 text-sm">
            {settlements.map((x) => (
              <li key={x.id} className="flex justify-between py-1.5">
                <span>{x.created_at.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}{x.note && ` · ${x.note}`}</span>
                <span className="font-medium">{rupees(x.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
