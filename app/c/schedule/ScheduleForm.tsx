'use client'
import { useActionState } from 'react'
import { saveSchedule } from '@/app/actions/customer'
import { SubmitButton } from '@/components/SubmitButton'
import { PICKUP_SLOTS, RETURN_SLOTS, WEEKDAYS } from '@/lib/constants'

type Current = { weekdays: number[]; pickup_mode: string; pickup_slot: string; return_mode: string; return_slot: string; est_pieces: number } | null

export function ScheduleForm({ current, workingDays }: { current: Current; workingDays: number[] }) {
  const [state, action] = useActionState(saveSchedule, undefined)
  const days = current?.weekdays ?? [1, 4]
  return (
    <form action={action} className="card space-y-5">
      <fieldset>
        <legend className="label">Days</legend>
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d, i) => (
            <label key={d}>
              <input type="checkbox" name="weekdays" value={i} defaultChecked={days.includes(i)} disabled={!workingDays.includes(i)} className="peer sr-only" />
              <span className="chip w-full px-0 text-xs">{d}</span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-stone-500">Greyed out days are your presswala&apos;s holidays.</p>
      </fieldset>
      <fieldset>
        <legend className="label">Pickup</legend>
        <div className="mb-2 grid grid-cols-2 gap-2">
          {([['doorstep', 'From home'], ['self_drop', 'I drop at shop']] as const).map(([v, l]) => (
            <label key={v}>
              <input type="radio" name="pickup_mode" value={v} defaultChecked={(current?.pickup_mode ?? 'doorstep') === v} className="peer sr-only" />
              <span className="chip w-full">{l}</span>
            </label>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {PICKUP_SLOTS.map((s) => (
            <label key={s.id}>
              <input type="radio" name="pickup_slot" value={s.id} defaultChecked={(current?.pickup_slot ?? '07-09') === s.id} className="peer sr-only" />
              <span className="chip w-full">{s.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="label">Return (same evening)</legend>
        <div className="mb-2 grid grid-cols-2 gap-2">
          {([['doorstep', 'Deliver home'], ['self_collect', 'I collect']] as const).map(([v, l]) => (
            <label key={v}>
              <input type="radio" name="return_mode" value={v} defaultChecked={(current?.return_mode ?? 'doorstep') === v} className="peer sr-only" />
              <span className="chip w-full">{l}</span>
            </label>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {RETURN_SLOTS.map((s) => (
            <label key={s.id}>
              <input type="radio" name="return_slot" value={s.id} defaultChecked={(current?.return_slot ?? '18-20') === s.id} className="peer sr-only" />
              <span className="chip w-full">{s.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label className="label" htmlFor="est_pieces">Usual number of clothes</label>
        <input id="est_pieces" name="est_pieces" type="number" min={1} max={200} defaultValue={current?.est_pieces ?? 12} className="input w-28" />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-700">{state.ok}</p>}
      <SubmitButton className="btn-primary w-full py-3">{current ? 'Update schedule' : 'Start schedule'}</SubmitButton>
    </form>
  )
}
