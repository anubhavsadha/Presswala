import { redirect } from 'next/navigation'
import { subscribe } from '@/app/actions/customer'
import { SubmitButton } from '@/components/SubmitButton'
import { Card, Notice, PageHeader } from '@/components/ui'
import { requireRole } from '@/lib/auth'
import { rupees } from '@/lib/billing'
import { activeSubscription, getHousehold, priceList } from '@/lib/data'
import { formatDate } from '@/lib/dates'
import { sql } from '@/lib/db'

export const metadata = { title: 'Monthly plans' }

export default async function Plans({ searchParams }: PageProps<'/c/plans'>) {
  const s = await requireRole('customer')
  const q = await searchParams
  const h = await getHousehold(s.uid)
  if (!h?.presswala_id) redirect('/c/presswala')
  const [plans, sub, prices] = await Promise.all([
    sql<{ id: number; name: string; pieces_per_month: number; price: number; description: string }[]>`
      SELECT id, name, pieces_per_month, price, description FROM plans WHERE active ORDER BY price`,
    activeSubscription(s.uid),
    priceList(h.presswala_id),
  ])
  const regular = prices.find((p) => p.code === 'regular')?.price ?? 6

  return (
    <div className="space-y-4">
      <PageHeader title="Monthly plans" subtitle="Prepay for regular clothes and pay less per piece. Valid 30 days." back="/c" />
      {q.error && <Notice>You already have an active plan.</Notice>}
      {sub && (
        <Notice tone="green">
          Active: <b>{sub.plan_name}</b>, {sub.pieces_total - sub.pieces_used} pieces left, valid till {formatDate(sub.end_date)}.
        </Notice>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {plans.map((p, i) => {
          const perPiece = p.price / p.pieces_per_month
          const save = Math.max(0, regular * p.pieces_per_month - p.price)
          return (
            <Card key={p.id} className={i === 1 ? 'border-brand-500 ring-2 ring-brand-100' : ''}>
              {i === 1 && <div className="mb-1 text-xs font-semibold text-brand-700">Most popular</div>}
              <div className="text-lg font-bold">{p.name}</div>
              <div className="mt-1 text-3xl font-extrabold">{rupees(p.price)}<span className="text-sm font-normal text-stone-500">/month</span></div>
              <div className="mt-1 text-sm text-stone-600">{p.pieces_per_month} regular pieces · {rupees(Math.round(perPiece * 100) / 100)}/piece</div>
              {save > 0 && <div className="mt-1 text-sm font-medium text-emerald-700">Save {rupees(save)} vs {rupees(regular)}/piece</div>}
              <p className="mt-2 text-xs text-stone-500">{p.description}</p>
              {!sub && (
                <form action={subscribe} className="mt-3">
                  <input type="hidden" name="plan_id" value={p.id} />
                  <SubmitButton className="btn-primary w-full">Subscribe</SubmitButton>
                </form>
              )}
            </Card>
          )
        })}
      </div>
      <p className="text-xs text-stone-500">
        Plan pieces cover regular clothes and kids clothes. Sarees, bedsheets, lehengas and other large items are billed at your presswala&apos;s rate card.
        The plan amount is added to your khata; pay your presswala by UPI or cash. Unused pieces lapse at the end of 30 days.
      </p>
    </div>
  )
}
