'use client'
import { useActionState } from 'react'
import { saveCommission } from '@/app/actions/admin'
import { SubmitButton } from '@/components/SubmitButton'

export function CommissionForm({ commissionPct, subscriptionCommissionPct }: { commissionPct: number; subscriptionCommissionPct: number }) {
  const [state, action] = useActionState(saveCommission, undefined)
  return (
    <form action={action} className="card space-y-3">
      <h2 className="font-semibold">Platform commission</h2>
      <div><label className="label" htmlFor="commission_pct">On order bills (%)</label>
        <input id="commission_pct" name="commission_pct" type="number" step="0.5" min={0} max={50} defaultValue={commissionPct} className="input" /></div>
      <div><label className="label" htmlFor="subscription_commission_pct">On monthly plans (%)</label>
        <input id="subscription_commission_pct" name="subscription_commission_pct" type="number" step="0.5" min={0} max={50} defaultValue={subscriptionCommissionPct} className="input" /></div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-700">{state.ok}</p>}
      <SubmitButton className="btn-primary w-full">Save</SubmitButton>
    </form>
  )
}
