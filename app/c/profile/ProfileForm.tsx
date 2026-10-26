'use client'
import { useActionState } from 'react'
import { updateProfile } from '@/app/actions/customer'
import { LocationField } from '@/components/LocationField'
import { SubmitButton } from '@/components/SubmitButton'

type H = { name: string; area_id: number; address: string; landmark: string; lat: number | null; lng: number | null }

export function ProfileForm({ household: h, areas }: { household: H; areas: { id: number; name: string }[] }) {
  const [state, action] = useActionState(updateProfile, undefined)
  return (
    <form action={action} className="card space-y-4">
      <div>
        <label className="label" htmlFor="name">Name</label>
        <input id="name" name="name" defaultValue={h.name} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="area_id">Sector / society</label>
        <select id="area_id" name="area_id" defaultValue={h.area_id} className="input">
          {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <p className="mt-1 text-xs text-stone-500">Changing your area may change which presswalas can serve you.</p>
      </div>
      <div>
        <label className="label" htmlFor="address">House / flat, tower</label>
        <input id="address" name="address" defaultValue={h.address} className="input" required />
      </div>
      <div>
        <label className="label" htmlFor="landmark">Landmark</label>
        <input id="landmark" name="landmark" defaultValue={h.landmark} className="input" />
      </div>
      <LocationField initial={{ lat: h.lat, lng: h.lng }} label="Save my home location" />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-700">{state.ok}</p>}
      <SubmitButton className="btn-primary w-full">Save</SubmitButton>
    </form>
  )
}
