import Link from 'next/link'
import { Badge, Empty, PageHeader } from '@/components/ui'
import { requireRole } from '@/lib/auth'
import { rupees } from '@/lib/billing'
import { WEEKDAYS } from '@/lib/constants'
import { getPresswala } from '@/lib/data'
import { sql } from '@/lib/db'

export const metadata = { title: 'Customers' }

export default async function Customers({ searchParams }: PageProps<'/p/customers'>) {
  const s = await requireRole('presswala')
  const q = await searchParams
  const term = typeof q.q === 'string' ? q.q.trim().slice(0, 50) : ''
  const pw = await getPresswala(s.uid)
  // Only households linked to this presswala: his catchment, nobody else's.
  const rows = await sql<{ user_id: number; name: string; phone: string; address: string; area_name: string; owed: number; pending: number; weekdays: number[] | null; plan: string | null }[]>`
    SELECT h.user_id, u.name, u.phone, h.address, a.name AS area_name,
      COALESCE((SELECT sum(CASE WHEN kind = 'charge' THEN amount WHEN confirmed THEN -amount ELSE 0 END)
                FROM ledger_entries l WHERE l.customer_id = h.user_id AND l.presswala_id = ${s.uid}), 0)::float AS owed,
      (SELECT count(*) FROM ledger_entries l WHERE l.customer_id = h.user_id AND l.presswala_id = ${s.uid} AND kind = 'payment' AND NOT confirmed)::int AS pending,
      (SELECT weekdays FROM schedules sc WHERE sc.customer_id = h.user_id AND sc.active) AS weekdays,
      (SELECT plan_name FROM subscriptions sb WHERE sb.customer_id = h.user_id AND sb.status = 'active' LIMIT 1) AS plan
    FROM households h JOIN users u ON u.id = h.user_id JOIN areas a ON a.id = h.area_id
    WHERE h.presswala_id = ${s.uid}
      AND ${term ? sql`(u.name ILIKE ${'%' + term + '%'} OR h.address ILIKE ${'%' + term + '%'} OR u.phone LIKE ${'%' + term + '%'})` : sql`TRUE`}
    ORDER BY a.name, h.address`
  const totalOwed = rows.reduce((sum, r) => sum + Math.max(0, r.owed), 0)

  return (
    <div>
      <PageHeader title="Customers" subtitle={`${pw?.linked_homes ?? 0} of ${pw?.capacity_homes ?? 100} homes · ${rupees(Math.round(totalOwed))} to collect`} />
      <form className="mb-3"><input name="q" defaultValue={term} placeholder="Search name, flat or phone" className="input" /></form>
      {rows.length === 0 ? <Empty>{term ? 'No match.' : 'No customers yet. Households in your sectors can choose you once you are verified.'}</Empty> : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Link key={r.user_id} href={`/p/customers/${r.user_id}`} className="card flex items-center justify-between gap-3 p-3 hover:border-brand-200">
              <div className="min-w-0">
                <div className="truncate font-medium">{r.address}</div>
                <div className="text-xs text-stone-500">{r.name} · {r.area_name}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {r.weekdays && <Badge>{r.weekdays.map((d) => WEEKDAYS[d]).join(' ')}</Badge>}
                  {r.plan && <Badge tone="brand">{r.plan} plan</Badge>}
                  {r.pending > 0 && <Badge tone="amber">Payment to confirm</Badge>}
                </div>
              </div>
              <div className={`shrink-0 text-right text-sm font-semibold ${r.owed > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                {r.owed > 0 ? rupees(r.owed) : r.owed < 0 ? `+${rupees(-r.owed)}` : '✓'}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
