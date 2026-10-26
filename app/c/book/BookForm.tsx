'use client'
import { useActionState, useState } from 'react'
import { bookPickup } from '@/app/actions/customer'
import { SubmitButton } from '@/components/SubmitButton'
import { PICKUP_SLOTS, RETURN_SLOTS } from '@/lib/constants'
import type { SlotAdvice } from '@/lib/optimize'

export function BookForm({ date, advice, shop }: { date: string; advice: SlotAdvice[]; shop: string }) {
  const [state, action] = useActionState(bookPickup, undefined)
  const [pickupMode, setPickupMode] = useState<'doorstep' | 'self_drop'>('doorstep')
  const [returnMode, setReturnMode] = useState<'doorstep' | 'self_collect'>('doorstep')
  const [pieces, setPieces] = useState(10)
  const firstOpen = advice.find((a) => a.recommended)?.slot ?? advice.find((a) => !a.full)?.slot

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="service_date" value={date} />

      <fieldset>
        <legend className="label">How will clothes reach the presswala?</legend>
        <div className="grid grid-cols-2 gap-2">
          {([['doorstep', '🚪 Pick up from home'], ['self_drop', '🛍️ I will drop at shop']] as const).map(([v, l]) => (
            <label key={v}>
              <input type="radio" name="pickup_mode" value={v} checked={pickupMode === v} onChange={() => setPickupMode(v)} className="peer sr-only" />
              <span className="chip w-full py-3">{l}</span>
            </label>
          ))}
        </div>
        {pickupMode === 'self_drop' && <p className="mt-1 text-xs text-stone-500">Shop: {shop}</p>}
      </fieldset>

      <fieldset>
        <legend className="label">{pickupMode === 'doorstep' ? 'Pickup time' : 'When will you drop?'}</legend>
        <div className="grid gap-2">
          {PICKUP_SLOTS.map((slot) => {
            const a = advice.find((x) => x.slot === slot.id)
            const disabled = pickupMode === 'doorstep' && !!a?.full
            return (
              <label key={slot.id}>
                <input type="radio" name="pickup_slot" value={slot.id} defaultChecked={slot.id === firstOpen}
                  disabled={disabled} className="peer sr-only" required />
                <span className="chip w-full justify-between py-3">
                  <span>{slot.label}</span>
                  {pickupMode === 'doorstep' && a && (
                    <span className={`text-xs ${a.recommended ? 'font-semibold text-emerald-700' : 'text-stone-500'}`}>
                      {a.recommended ? '★ Best · ' : ''}{a.reason}
                    </span>
                  )}
                </span>
              </label>
            )
          })}
        </div>
        {pickupMode === 'doorstep' && (
          <p className="mt-1 text-xs text-stone-500">★ Best slot is when your presswala is already in your block, so he can come on time.</p>
        )}
      </fieldset>

      <fieldset>
        <legend className="label">Getting clothes back</legend>
        <div className="mb-2 grid grid-cols-2 gap-2">
          {([['doorstep', '🏠 Deliver home'], ['self_collect', '🛍️ I will collect']] as const).map(([v, l]) => (
            <label key={v}>
              <input type="radio" name="return_mode" value={v} checked={returnMode === v} onChange={() => setReturnMode(v)} className="peer sr-only" />
              <span className="chip w-full py-3">{l}</span>
            </label>
          ))}
        </div>
        <div className="label text-xs text-stone-500">{returnMode === 'doorstep' ? 'I will be home between' : 'I will collect between'}</div>
        <div className="grid grid-cols-3 gap-2">
          {RETURN_SLOTS.map((slot) => (
            <label key={slot.id}>
              <input type="radio" name="return_slot" value={slot.id} defaultChecked={slot.id === '18-20'} className="peer sr-only" />
              <span className="chip w-full">{slot.label}</span>
            </label>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {([['same', 'Same day'], ['next', 'Next day']] as const).map(([v, l]) => (
            <label key={v}>
              <input type="radio" name="return_day" value={v} defaultChecked={v === 'same'} className="peer sr-only" />
              <span className="chip w-full">{l}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="label" htmlFor="est_pieces">Roughly how many clothes?</label>
        <div className="flex items-center gap-3">
          <button type="button" className="btn-secondary size-11 p-0 text-xl" onClick={() => setPieces((p) => Math.max(1, p - 1))}>−</button>
          <input id="est_pieces" name="est_pieces" type="number" min={1} max={200} value={pieces}
            onChange={(e) => setPieces(Number(e.target.value) || 1)} className="input w-24 text-center text-lg font-semibold" />
          <button type="button" className="btn-secondary size-11 p-0 text-xl" onClick={() => setPieces((p) => Math.min(200, p + 1))}>+</button>
        </div>
        <p className="mt-1 text-xs text-stone-500">An estimate is fine. The presswala counts at pickup and the bill uses his count.</p>
      </div>

      <div>
        <label className="label" htmlFor="notes">Notes (optional)</label>
        <input id="notes" name="notes" className="input" placeholder="2 sarees, 1 double bedsheet, ring bell twice…" maxLength={300} />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <SubmitButton className="btn-primary w-full py-3 text-base" pendingText="Booking…">Confirm booking</SubmitButton>
    </form>
  )
}
