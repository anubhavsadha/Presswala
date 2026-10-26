import Link from 'next/link'
import { Empty, PageHeader, StatusBadge } from '@/components/ui'
import { requireRole } from '@/lib/auth'
import { rupees } from '@/lib/billing'
import { slotLabel } from '@/lib/constants'
import { formatDate } from '@/lib/dates'
import { sql } from '@/lib/db'

export const metadata = { title: 'Orders' }

export default async function Orders() {
  const s = await requireRole('customer')
  const orders = await sql<{ id: number; status: string; service_date: string; pickup_slot: string; pickup_mode: string; est_pieces: number; total: number; source: string }[]>`
    SELECT id, status, service_date, pickup_slot, pickup_mode, est_pieces, total, source FROM orders
    WHERE customer_id = ${s.uid} ORDER BY service_date DESC, id DESC LIMIT 100`
  return (
    <div>
      <PageHeader title="Orders" action={<Link href="/c/book" className="btn-primary">New</Link>} />
      {orders.length === 0 ? <Empty>No orders yet.</Empty> : (
        <div className="space-y-2">
          {orders.map((o) => (
            <Link key={o.id} href={`/c/orders/${o.id}`} className="card flex items-center justify-between gap-3 hover:border-brand-200">
              <div>
                <div className="font-medium">{formatDate(o.service_date)} · {slotLabel(o.pickup_slot)}</div>
                <div className="text-xs text-stone-500">
                  #{o.id} · {o.est_pieces} pcs{o.total ? ` · ${rupees(o.total)}` : ''}
                  {o.source === 'schedule' && ' · weekly'}{o.pickup_mode === 'self_drop' && ' · self drop'}
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
