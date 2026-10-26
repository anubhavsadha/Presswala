'use client'
import { useActionState } from 'react'
import { addArea } from '@/app/actions/admin'
import { SubmitButton } from '@/components/SubmitButton'

export function AreaForm() {
  const [state, action] = useActionState(addArea, undefined)
  return (
    <form action={action} className="card grid gap-2 sm:grid-cols-5">
      <input name="name" placeholder="Name, e.g. Sector 65" className="input sm:col-span-2" required />
      <input name="locality" placeholder="Locality" className="input" />
      <input name="lat" type="number" step="any" placeholder="Lat" className="input" />
      <input name="lng" type="number" step="any" placeholder="Lng" className="input" />
      <div className="flex items-center gap-3 sm:col-span-5">
        <SubmitButton className="btn-primary">Add area</SubmitButton>
        <span className="text-xs text-stone-500">Centre point is used when a home has no GPS location (right-click a spot in Google Maps to copy it).</span>
      </div>
      {state?.error && <p className="text-sm text-red-600 sm:col-span-5">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-700 sm:col-span-5">{state.ok}</p>}
    </form>
  )
}
