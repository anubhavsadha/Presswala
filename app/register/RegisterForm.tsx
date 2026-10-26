'use client'
import { useActionState } from 'react'
import { registerCustomer, registerPresswala } from '@/app/actions/auth'
import { LocationField } from '@/components/LocationField'
import { SubmitButton } from '@/components/SubmitButton'

type Area = { id: number; name: string; locality: string }

export function RegisterForm({ role, areas }: { role: 'customer' | 'presswala'; areas: Area[] }) {
  const [state, action] = useActionState(role === 'presswala' ? registerPresswala : registerCustomer, undefined)
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="name">Your name</label>
        <input id="name" name="name" required className="input" autoComplete="name" />
      </div>
      <div>
        <label className="label" htmlFor="phone">Mobile number</label>
        <input id="phone" name="phone" type="tel" inputMode="numeric" required className="input" placeholder="98100 12345" autoComplete="tel" />
      </div>
      <div>
        <label className="label" htmlFor="password">Choose a password</label>
        <input id="password" name="password" type="password" minLength={6} required className="input" autoComplete="new-password" />
      </div>

      {role === 'customer' ? (
        <>
          <div>
            <label className="label" htmlFor="area_id">Sector / society</label>
            <select id="area_id" name="area_id" required className="input" defaultValue="">
              <option value="" disabled>Select…</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}{a.locality && ` – ${a.locality}`}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="address">House / flat no., tower, floor</label>
            <input id="address" name="address" required className="input" placeholder="B-1204, Tower B" />
          </div>
          <div>
            <label className="label" htmlFor="landmark">Landmark (optional)</label>
            <input id="landmark" name="landmark" className="input" placeholder="Near gate 2" />
          </div>
          <LocationField label="Save my home location" />
        </>
      ) : (
        <>
          <div>
            <label className="label" htmlFor="shop_name">Shop / stall name</label>
            <input id="shop_name" name="shop_name" className="input" placeholder="Ramesh Press Point" />
          </div>
          <div>
            <label className="label" htmlFor="shop_address">Where is your stall?</label>
            <input id="shop_address" name="shop_address" className="input" placeholder="Under the tree near Block C market" />
          </div>
          <div>
            <label className="label" htmlFor="upi_id">UPI ID (for customer payments)</label>
            <input id="upi_id" name="upi_id" className="input" placeholder="9810012345@paytm" />
          </div>
          <fieldset>
            <legend className="label">Sectors / societies you serve</legend>
            <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto rounded-xl border border-stone-200 p-2">
              {areas.map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="area_ids" value={a.id} className="size-4 accent-brand-600" /> {a.name}
                </label>
              ))}
            </div>
          </fieldset>
          <LocationField label="Save my stall location" />
          <p className="text-xs text-stone-500">Your profile is checked by our team before customers can see it.</p>
        </>
      )}

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <SubmitButton className="btn-primary w-full py-3">Create account</SubmitButton>
    </form>
  )
}
