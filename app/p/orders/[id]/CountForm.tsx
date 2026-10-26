'use client'
import { useActionState, useState } from 'react'
import { recordPickup } from '@/app/actions/presswala'
import { SubmitButton } from '@/components/SubmitButton'
import { computeBill, rupees } from '@/lib/billing'

type Price = { id: number; code: string; name: string; price: number; isRegular: boolean }

export function CountForm({ orderId, prices, counted, subLeft, saved }: {
  orderId: number; prices: Price[]; counted: Record<string, number>; subLeft: number; saved: boolean
}) {
  const [state, action] = useActionState(recordPickup, undefined)
  const [qty, setQty] = useState<Record<number, number>>(() => Object.fromEntries(prices.map((p) => [p.id, counted[p.code] ?? 0])))
  const bill = computeBill(prices.map((p) => ({ code: p.code, name: p.name, unitPrice: p.price, isRegular: p.isRegular, qty: qty[p.id] ?? 0 })), subLeft, 0)
  const set = (id: number, v: number) => setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(500, v)) }))

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="order_id" value={orderId} />
      <ul className="divide-y divide-stone-100">
        {prices.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-2 py-2">
            <div className="min-w-0">
              <div className="text-sm font-medium">{p.name}</div>
              <div className="text-xs text-stone-500">{rupees(p.price)} each</div>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => set(p.id, (qty[p.id] ?? 0) - 1)} className="btn-secondary size-10 p-0 text-lg">−</button>
              <input name={`qty_${p.id}`} type="number" inputMode="numeric" min={0} value={qty[p.id] ?? 0}
                onChange={(e) => set(p.id, Number(e.target.value) || 0)} className="input w-14 px-1 text-center font-semibold" />
              <button type="button" onClick={() => set(p.id, (qty[p.id] ?? 0) + 1)} className="btn-secondary size-10 p-0 text-lg">+</button>
            </div>
          </li>
        ))}
      </ul>
      <div className="rounded-xl bg-stone-50 p-3 text-sm">
        <div className="flex justify-between"><span>{bill.pieces} pieces</span><span>{rupees(bill.subtotal)}</span></div>
        {bill.discount > 0 && <div className="flex justify-between text-emerald-700"><span>Monthly plan ({bill.subscriptionPieces} pcs)</span><span>−{rupees(bill.discount)}</span></div>}
        <div className="mt-1 flex justify-between text-base font-bold"><span>Bill</span><span>{rupees(bill.total)}</span></div>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-700">{state.ok}</p>}
      <SubmitButton className="btn-primary w-full py-3">{saved ? 'Update count' : 'Save · collected'}</SubmitButton>
    </form>
  )
}
