import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui'
import { requireRole } from '@/lib/auth'
import { WEEKDAYS } from '@/lib/constants'
import { getHousehold, getPresswala, slotAdvice } from '@/lib/data'
import { addDays, formatDate, isValidDate, todayIST, weekday } from '@/lib/dates'
import { BookForm } from './BookForm'

export const metadata = { title: 'Book pickup' }

export default async function BookPage({ searchParams }: PageProps<'/c/book'>) {
  const s = await requireRole('customer')
  const q = await searchParams
  const h = await getHousehold(s.uid)
  if (!h?.presswala_id) redirect('/c/presswala')
  const pw = await getPresswala(h.presswala_id)
  if (!pw) redirect('/c/presswala')

  const today = todayIST()
  const days = Array.from({ length: 8 }, (_, i) => addDays(today, i)).map((d) => ({
    date: d, open: pw.working_days.includes(weekday(d)),
  }))
  // Today is only offered while a slot is still open.
  const todayAdvice = await slotAdvice(pw.user_id, today, h.area_id)
  if (days[0].open && todayAdvice.every((a) => a.full)) days[0].open = false

  const requested = typeof q.date === 'string' && isValidDate(q.date) ? q.date : null
  const date = days.find((d) => d.date === requested && d.open)?.date ?? days.find((d) => d.open)?.date
  const advice = date ? (date === today ? todayAdvice : await slotAdvice(pw.user_id, date, h.area_id)) : []

  return (
    <div>
      <PageHeader title="Book a pickup" subtitle={`with ${pw.name} · ${h.area_name}`} />
      <div className="label">Day</div>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {days.map((d) => (
          d.open ? (
            <Link key={d.date} href={`/c/book?date=${d.date}`} scroll={false}
              className={`chip min-w-20 flex-col ${d.date === date ? 'chip-on' : ''}`}>
              <span className="text-xs">{WEEKDAYS[weekday(d.date)]}</span>
              <span>{formatDate(d.date).replace(/^\w{3}, /, '')}</span>
            </Link>
          ) : (
            <span key={d.date} className="chip min-w-20 flex-col cursor-not-allowed bg-stone-100 text-stone-400">
              <span className="text-xs">{WEEKDAYS[weekday(d.date)]}</span>
              <span>Closed</span>
            </span>
          )
        ))}
      </div>
      {date ? (
        <BookForm key={date} date={date} advice={advice} shop={pw.shop_address || pw.shop_name} />
      ) : (
        <p className="text-sm text-stone-500">Your presswala has no open days this week.</p>
      )}
    </div>
  )
}
