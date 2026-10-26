'use client'
import { useActionState } from 'react'
import { updatePrices, updateShop } from '@/app/actions/presswala'
import { LocationField } from '@/components/LocationField'
import { SubmitButton } from '@/components/SubmitButton'
import { WEEKDAYS } from '@/lib/constants'

type Shop = {
  shop_name: string; shop_address: string; upi_id: string; capacity_homes: number; daily_piece_capacity: number
  slot_capacity: number; working_days: number[]; accepting: boolean; lat: number | null; lng: number | null
}

export function ShopForm({ pw, areas, mine }: { pw: Shop; areas: { id: number; name: string }[]; mine: number[] }) {
  const [state, action] = useActionState(updateShop, undefined)
  return (
    <form action={action} className="card space-y-4">
      <h2 className="font-semibold">Shop · दुकान</h2>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="accepting" defaultChecked={pw.accepting} className="size-5 accent-brand-600" />
        Accepting new customers
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="shop_name">Shop name</label><input id="shop_name" name="shop_name" defaultValue={pw.shop_name} className="input" /></div>
        <div><label className="label" htmlFor="upi_id">UPI ID</label><input id="upi_id" name="upi_id" defaultValue={pw.upi_id} className="input" placeholder="98100xxxxx@paytm" /></div>
      </div>
      <div><label className="label" htmlFor="shop_address">Stall address</label><input id="shop_address" name="shop_address" defaultValue={pw.shop_address} className="input" /></div>
      <LocationField initial={{ lat: pw.lat, lng: pw.lng }} label="Save stall location (stand at your stall)" />
      <fieldset>
        <legend className="label">Working days</legend>
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d, i) => (
            <label key={d}>
              <input type="checkbox" name="working_days" value={i} defaultChecked={pw.working_days.includes(i)} className="peer sr-only" />
              <span className="chip w-full px-0 text-xs">{d}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-3 gap-3">
        <div><label className="label text-xs" htmlFor="capacity_homes">Max homes</label><input id="capacity_homes" name="capacity_homes" type="number" min={1} defaultValue={pw.capacity_homes} className="input" /></div>
        <div><label className="label text-xs" htmlFor="daily_piece_capacity">Clothes / day</label><input id="daily_piece_capacity" name="daily_piece_capacity" type="number" min={10} defaultValue={pw.daily_piece_capacity} className="input" /></div>
        <div><label className="label text-xs" htmlFor="slot_capacity">Pickups / slot</label><input id="slot_capacity" name="slot_capacity" type="number" min={1} defaultValue={pw.slot_capacity} className="input" /></div>
      </div>
      <p className="text-xs text-stone-500">Pickups per slot limits how many homes can book each 2-hour window, so you are never late.</p>
      <fieldset>
        <legend className="label">Sectors / societies you serve</legend>
        <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto rounded-xl border border-stone-200 p-2">
          {areas.map((a) => (
            <label key={a.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="area_ids" value={a.id} defaultChecked={mine.includes(a.id)} className="size-4 accent-brand-600" /> {a.name}
            </label>
          ))}
        </div>
      </fieldset>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-700">{state.ok}</p>}
      <SubmitButton className="btn-primary w-full">Save shop settings</SubmitButton>
    </form>
  )
}

type Price = { id: number; name: string; price: number; active: boolean; is_regular: boolean }

export function PriceForm({ prices }: { prices: Price[] }) {
  const [state, action] = useActionState(updatePrices, undefined)
  return (
    <form action={action} className="card space-y-3">
      <h2 className="font-semibold">Rate card · रेट</h2>
      <ul className="divide-y divide-stone-100">
        {prices.map((p) => (
          <li key={p.id} className="flex items-center gap-2 py-2">
            <input type="checkbox" name={`active_${p.id}`} defaultChecked={p.active} className="size-4 accent-brand-600" aria-label={`Offer ${p.name}`} />
            <span className="flex-1 text-sm">{p.name}{p.is_regular && <span className="ml-1 text-xs text-brand-700">(plan)</span>}</span>
            <span className="text-sm text-stone-500">₹</span>
            <input name={`price_${p.id}`} type="number" min={0} step="0.5" defaultValue={p.price} className="input w-20 px-2 text-right" aria-label={`${p.name} price`} />
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input name="new_name" placeholder="Add item, e.g. Sherwani" className="input" />
        <input name="new_price" type="number" min={0} step="0.5" placeholder="₹" className="input w-20" />
      </div>
      {state?.ok && <p className="text-sm text-emerald-700">{state.ok}</p>}
      <SubmitButton className="btn-primary w-full">Save rates</SubmitButton>
    </form>
  )
}
