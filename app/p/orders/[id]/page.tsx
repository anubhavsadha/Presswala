import Link from 'next/link'
import { notFound } from 'next/navigation'
import { declineOrder, setStatus } from '@/app/actions/presswala'
import { SubmitButton } from '@/components/SubmitButton'
import { Card, PageHeader, StatusBadge } from '@/components/ui'
import { requireRole } from '@/lib/auth'
import { rupees } from '@/lib/billing'
import { slotLabel } from '@/lib/constants'
import { activeSubscription, balance, priceList } from '@/lib/data'
import { formatDate } from '@/lib/dates'
import { sql } from '@/lib/db'
import { CountForm } from './CountForm'

export default async function PresswalaOrder({ params }: PageProps<'/p/orders/[id]'>) {
  const s = await requireRole('presswala')
  const { id } = await params
  if (!/^\d+$/.test(id)) notFound()
  const [o] = await sql<{
    id: number; customer_id: number; status: string; service_date: string; pickup_mode: string; pickup_slot: string
    return_mode: string; return_date: string; return_slot: string; est_pieces: number; notes: string; total: number
    subtotal: number; discount: number; subscription_pieces: number; name: string; phone: string; address: string; landmark: string; area_name: string
  }[]>`
    SELECT o.*, u.name, u.phone, h.address, h.landmark, a.name AS area_name
    FROM orders o JOIN users u ON u.id = o.customer_id JOIN households h ON h.user_id = o.customer_id JOIN areas a ON a.id = o.area_id
    WHERE o.id = ${id} AND o.presswala_id = ${s.uid}`
  if (!o) notFound()
  const [prices, items, sub, bal] = await Promise.all([
    priceList(s.uid),
    sql<{ code: string; qty: number }[]>`SELECT code, qty FROM order_items WHERE order_id = ${o.id}`,
    activeSubscription(o.customer_id),
    balance(o.customer_id, s.uid),
  ])
  const counted = Object.fromEntries(items.map((i) => [i.code, i.qty]))
  const subLeft = sub && sub.presswala_id === s.uid ? sub.pieces_total - sub.pieces_used + (o.subscription_pieces || 0) : 0
  const editable = ['requested', 'accepted', 'picked_up', 'ready'].includes(o.status)

  return (
    <div className="space-y-4">
      <PageHeader title={`Order #${o.id}`} back="/p" action={<StatusBadge status={o.status} hindi />} />
      <Card>
        <div className="font-semibold">{o.address}</div>
        <div className="text-sm text-stone-600">{o.name} · {o.area_name}{o.landmark && ` · ${o.landmark}`}</div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <div><div className="text-xs text-stone-500">{o.pickup_mode === 'doorstep' ? 'Pickup' : 'Self drop'}</div>{formatDate(o.service_date)}, {slotLabel(o.pickup_slot)}</div>
          <div><div className="text-xs text-stone-500">{o.return_mode === 'doorstep' ? 'Deliver' : 'Customer collects'}</div>{formatDate(o.return_date)}, {slotLabel(o.return_slot)}</div>
        </div>
        {o.notes && <div className="mt-2 text-sm text-amber-800">📝 {o.notes}</div>}
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={`tel:${o.phone}`} className="btn-secondary px-3 py-1.5 text-sm">📞 Call</a>
          <Link href={`/p/customers/${o.customer_id}`} className="btn-secondary px-3 py-1.5 text-sm">Khata: {rupees(bal.owed)}</Link>
        </div>
      </Card>

      {editable && (
        <Card>
          <h2 className="font-semibold">Count clothes · कपड़े गिनें</h2>
          <p className="mb-3 text-sm text-stone-500">
            Customer estimated ~{o.est_pieces}. {subLeft > 0 && <span className="font-medium text-emerald-700">Monthly plan: {subLeft} regular pieces left.</span>}
          </p>
          <CountForm orderId={o.id} prices={prices.map((p) => ({ id: p.id, code: p.code, name: p.name, price: p.price, isRegular: p.is_regular }))}
            counted={counted} subLeft={subLeft} saved={items.length > 0} />
        </Card>
      )}

      {!editable && items.length > 0 && (
        <Card><div className="flex justify-between font-semibold"><span>Total billed</span><span>{rupees(o.total)}</span></div></Card>
      )}

      <div className="grid gap-2">
        {o.status === 'picked_up' && (
          <form action={setStatus}>
            <input type="hidden" name="order_id" value={o.id} /><input type="hidden" name="status" value="ready" />
            <SubmitButton className="btn-secondary w-full py-3">✓ Ironed · तैयार</SubmitButton>
          </form>
        )}
        {(o.status === 'picked_up' || o.status === 'ready') && (
          <form action={setStatus}>
            <input type="hidden" name="order_id" value={o.id} /><input type="hidden" name="status" value="delivered" />
            <SubmitButton className="btn-primary w-full py-3">🏠 Delivered · दे दिया</SubmitButton>
          </form>
        )}
        {(o.status === 'requested' || o.status === 'accepted') && (
          <form action={declineOrder} className="flex gap-2">
            <input type="hidden" name="order_id" value={o.id} />
            <input name="reason" placeholder="Reason (optional)" className="input" />
            <SubmitButton className="btn-danger shrink-0">Can&apos;t come</SubmitButton>
          </form>
        )}
      </div>
    </div>
  )
}
