import { redirect } from 'next/navigation'
import { stopSchedule } from '@/app/actions/customer'
import { SubmitButton } from '@/components/SubmitButton'
import { PageHeader } from '@/components/ui'
import { requireRole } from '@/lib/auth'
import { getHousehold, getPresswala } from '@/lib/data'
import { sql } from '@/lib/db'
import { ScheduleForm } from './ScheduleForm'

export const metadata = { title: 'Weekly schedule' }

export default async function SchedulePage() {
  const s = await requireRole('customer')
  const h = await getHousehold(s.uid)
  if (!h?.presswala_id) redirect('/c/presswala')
  const pw = await getPresswala(h.presswala_id)
  const [current] = await sql<{ weekdays: number[]; pickup_mode: string; pickup_slot: string; return_mode: string; return_slot: string; est_pieces: number }[]>`
    SELECT weekdays, pickup_mode, pickup_slot, return_mode, return_slot, est_pieces FROM schedules WHERE customer_id = ${s.uid} AND active`
  return (
    <div>
      <PageHeader title="Weekly schedule" subtitle="Most homes do 2–3 pickups a week. Set it once; bookings are created automatically." back="/c" />
      <ScheduleForm current={current ?? null} workingDays={pw?.working_days ?? [1, 2, 3, 4, 5, 6]} />
      {current && (
        <form action={stopSchedule} className="mt-4">
          <SubmitButton className="btn-danger w-full">Stop weekly schedule</SubmitButton>
        </form>
      )}
    </div>
  )
}
