import { notFound } from 'next/navigation'
import { cancelOrder, rateOrder, updateReturn } from '@/app/actions/customer'
import { SubmitButton } from '@/components/SubmitButton'
import { Card, Notice, PageHeader, StatusBadge } from '@/components/ui'
import { requireRole } from '@/lib/auth'
import { rupees } from '@/lib/billing'
import { RETURN_SLOTS, slotLabel } from '@/lib/constants'
import { formatDate, todayIST } from '@/lib/dates'
import { sql } from '@/lib/db'

export default async function OrderDetail({ params, searchParams }: PageProps<'/c/orders/[id]'>) {
  const s = await requireRole('customer')
  const { id } = await params
  const q = await searchParams
  if (!/^\d+$/.test(id)) notFound()
  const [o] = await sql<{
    id: number; status: string; service_date: string; pickup_mode: string; pickup_slot: string; return_mode: string
    return_date: string; return_slot: string; est_pieces: number; subtotal: number; discount: number; total: number
    subscription_pieces: number; notes: string; rating: number | null; review: string | null; pw_name: string; pw_phone: string
    shop_address: string; picked_up_at: Date | null; ready_at: Date | null; delivered_at: Date | null; created_at: Date
  }[]>`
    SELECT o.*, u.name AS pw_name, u.phone AS pw_phone, p.shop_address
    FROM orders o JOIN users u ON u.id = o.presswala_id JOIN presswalas p ON p.user_id = o.presswala_id
    WHERE o.id = ${id} AND o.customer_id = ${s.uid}`
  if (!o) notFound()
  const items = await sql<{ name: string; qty: number; unit_price: number }[]>`
    SELECT name, qty, unit_price FROM order_items WHERE order_id = ${o.id} ORDER BY id`

  const steps = [
    { key: 'requested', label: o.pickup_mode === 'doorstep' ? `Pickup ${formatDate(o.service_date)}, ${slotLabel(o.pickup_slot)}` : `Drop at shop ${formatDate(o.service_date)}, ${slotLabel(o.pickup_slot)}`, at: o.created_at },
    { key: 'picked_up', label: 'Collected & counted', at: o.picked_up_at },
    { key: 'ready', label: 'Ironed', at: o.ready_at },
    { key: 'delivered', label: o.return_mode === 'doorstep' ? `Delivered (${formatDate(o.return_date)}, ${slotLabel(o.return_slot)})` : `Collected from shop (${formatDate(o.return_date)})`, at: o.delivered_at },
  ]
  const order = ['requested', 'accepted', 'picked_up', 'ready', 'delivered']
  const reached = order.indexOf(o.status)
  const canEditReturn = ['requested', 'accepted', 'picked_up', 'ready'].includes(o.status)
  const time = (d: Date | null) => d?.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })

  return (
    <div className="space-y-4">
      <PageHeader title={`Order #${o.id}`} back="/c/orders" action={<StatusBadge status={o.status} />} />
      {q.booked && <Notice tone="green">Booked! {o.pw_name} will see it in his plan for the day.</Notice>}

      <Card>
        <ol className="space-y-3">
          {steps.map((st, i) => {
            const done = o.status !== 'cancelled' && reached >= order.indexOf(st.key)
            return (
              <li key={st.key} className="flex items-start gap-3">
                <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${done ? 'bg-brand-600 text-white' : 'bg-stone-200 text-stone-500'}`}>{done ? '✓' : i + 1}</span>
                <div>
                  <div className={done ? 'font-medium' : 'text-stone-500'}>{st.label}</div>
                  {done && st.at && i > 0 && <div className="text-xs text-stone-500">{time(st.at)}</div>}
                </div>
              </li>
            )
          })}
        </ol>
        <div className="mt-3 border-t border-stone-100 pt-3 text-sm text-stone-600">
          {o.pw_name} · <a href={`tel:${o.pw_phone}`} className="text-brand-700">Call</a>
          {o.notes && <div className="mt-1">Note: {o.notes}</div>}
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">Bill</h2>
        {items.length === 0 ? (
          <p className="text-sm text-stone-500">About {o.est_pieces} pieces. The final bill appears once your clothes are counted at pickup.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {items.map((it) => (
                <tr key={it.name} className="border-b border-stone-100">
                  <td className="py-1.5">{it.name}</td>
                  <td className="py-1.5 text-right text-stone-500">{it.qty} × {rupees(it.unit_price)}</td>
                  <td className="py-1.5 text-right">{rupees(it.qty * it.unit_price)}</td>
                </tr>
              ))}
              {o.discount > 0 && (
                <tr><td className="py-1.5 text-emerald-700" colSpan={2}>Monthly plan ({o.subscription_pieces} pcs)</td><td className="py-1.5 text-right text-emerald-700">−{rupees(o.discount)}</td></tr>
              )}
              <tr className="font-semibold"><td className="pt-2" colSpan={2}>Total</td><td className="pt-2 text-right">{rupees(o.total)}</td></tr>
            </tbody>
          </table>
        )}
      </Card>

      {canEditReturn && (
        <Card>
          <h2 className="mb-2 font-semibold">When will you be home?</h2>
          <form action={updateReturn} className="space-y-3">
            <input type="hidden" name="order_id" value={o.id} />
            <div className="grid grid-cols-2 gap-2">
              {([['doorstep', 'Deliver home'], ['self_collect', 'I will collect']] as const).map(([v, l]) => (
                <label key={v}>
                  <input type="radio" name="return_mode" value={v} defaultChecked={o.return_mode === v} className="peer sr-only" />
                  <span className="chip w-full">{l}</span>
                </label>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {RETURN_SLOTS.map((sl) => (
                <label key={sl.id}>
                  <input type="radio" name="return_slot" value={sl.id} defaultChecked={o.return_slot === sl.id} className="peer sr-only" />
                  <span className="chip w-full">{sl.label}</span>
                </label>
              ))}
            </div>
            <input type="date" name="return_date" defaultValue={o.return_date} min={todayIST() > o.service_date ? todayIST() : o.service_date} className="input" />
            <SubmitButton className="btn-secondary w-full">Update return time</SubmitButton>
          </form>
        </Card>
      )}

      {o.status === 'delivered' && (
        <Card>
          <h2 className="mb-2 font-semibold">{o.rating ? 'Your rating' : 'How was the ironing?'}</h2>
          <form action={rateOrder} className="space-y-3">
            <input type="hidden" name="order_id" value={o.id} />
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((r) => (
                <label key={r}>
                  <input type="radio" name="rating" value={r} defaultChecked={o.rating === r} className="peer sr-only" required />
                  <span className="chip size-11 text-lg">{r}★</span>
                </label>
              ))}
            </div>
            <input name="review" defaultValue={o.review ?? ''} placeholder="Anything to tell him? (optional)" className="input" maxLength={300} />
            <SubmitButton className="btn-secondary">Save rating</SubmitButton>
          </form>
        </Card>
      )}

      {['requested', 'accepted'].includes(o.status) && (
        <form action={cancelOrder}>
          <input type="hidden" name="order_id" value={o.id} />
          <SubmitButton className="btn-danger w-full">Cancel this pickup</SubmitButton>
        </form>
      )}
    </div>
  )
}
