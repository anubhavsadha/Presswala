import Link from 'next/link'
import { Empty, PageHeader, StatusBadge } from '@/components/ui'
import { requireRole } from '@/lib/auth'
import { rupees } from '@/lib/billing'
import { slotLabel } from '@/lib/constants'
import { formatDate } from '@/lib/dates'
import { sql } from '@/lib/db'

export const metadata = { title: 'Orders' }

const FILTERS = [
  { id: 'open', label: 'Open', statuses: ['requested', 'accepted'] },
  { id: 'shop', label: 'In shop', statuses: ['picked_up', 'ready'] },
  { id: 'done', label: 'Delivered', statuses: ['delivered'] },
  { id: 'cancelled', label: 'Cancelled', statuses: ['cancelled'] },
]

export default async function PresswalaOrders({ searchParams }: PageProps<'/p/orders'>) {
  const s = await requireRole('presswala')
  const q = await searchParams
  const f = FILTERS.find((x) => x.id === q.f) ?? FILTERS[1]
  const orders = await sql<{ id: number; status: string; service_date: string; pickup_slot: string; return_date: string; return_slot: string; est_pieces: number; total: number; name: string; address: string; area_name: string }[]>`
    SELECT o.id, o.status, o.service_date, o.pickup_slot, o.return_date, o.return_slot, o.est_pieces, o.total,
           u.name, h.address, a.name AS area_name
    FROM orders o JOIN users u ON u.id = o.customer_id JOIN households h ON h.user_id = o.customer_id JOIN areas a ON a.id = o.area_id
    WHERE o.presswala_id = ${s.uid} AND o.status = ANY(${f.statuses})
    ORDER BY ${f.id === 'open' ? sql`o.service_date, o.pickup_slot` : f.id === 'shop' ? sql`o.return_date, o.return_slot` : sql`o.service_date DESC`}
    LIMIT 200`
  return (
    <div>
      <PageHeader title="Orders" />
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {FILTERS.map((x) => <Link key={x.id} href={`/p/orders?f=${x.id}`} className={`chip ${x.id === f.id ? 'chip-on' : ''}`}>{x.label}</Link>)}
      </div>
      {orders.length === 0 ? <Empty>Nothing here.</Empty> : (
        <div className="space-y-2">
          {orders.map((o) => (
            <Link key={o.id} href={`/p/orders/${o.id}`} className="card flex items-center justify-between gap-3 p-3 hover:border-brand-200">
              <div className="min-w-0">
                <div className="truncate font-medium">{o.address} · {o.area_name}</div>
                <div className="text-xs text-stone-500">
                  #{o.id} · {o.name} · {f.id === 'shop' ? `return ${formatDate(o.return_date)} ${slotLabel(o.return_slot)}` : `${formatDate(o.service_date)} ${slotLabel(o.pickup_slot)}`}
                  {' · '}{o.est_pieces} pcs{o.total ? ` · ${rupees(o.total)}` : ''}
                </div>
              </div>
              <StatusBadge status={o.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
