'use client'
import { useActionState } from 'react'
import { addPlan } from '@/app/actions/admin'
import { SubmitButton } from '@/components/SubmitButton'

export function PlanForm() {
  const [state, action] = useActionState(addPlan, undefined)
  return (
    <form action={action} className="card grid gap-2 sm:grid-cols-4">
      <input name="name" placeholder="Plan name" className="input" required />
      <input name="pieces_per_month" type="number" min={1} placeholder="Pieces / month" className="input" required />
      <input name="price" type="number" min={0} step="1" placeholder="Price ₹" className="input" required />
      <SubmitButton className="btn-primary">Add plan</SubmitButton>
      <input name="description" placeholder="Short description" className="input sm:col-span-4" />
      {state?.error && <p className="text-sm text-red-600 sm:col-span-4">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-700 sm:col-span-4">{state.ok}</p>}
    </form>
  )
}
