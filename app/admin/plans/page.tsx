import { togglePlan } from '@/app/actions/admin'
import { SubmitButton } from '@/components/SubmitButton'
import { Badge, Card, PageHeader } from '@/components/ui'
import { requireRole } from '@/lib/auth'
import { rupees } from '@/lib/billing'
import { sql } from '@/lib/db'
import { PlanForm } from './PlanForm'

export const metadata = { title: 'Plans' }

export default async function AdminPlans() {
  await requireRole('admin')
  const plans = await sql<{ id: number; name: string; pieces_per_month: number; price: number; description: string; active: boolean; subs: number }[]>`
    SELECT p.*, (SELECT count(*) FROM subscriptions s WHERE s.plan_id = p.id AND s.status = 'active')::int AS subs
    FROM plans p ORDER BY p.active DESC, p.price`
  return (
    <div className="space-y-4">
      <PageHeader title="Subscription plans" subtitle="Monthly prepaid plans that keep households on the platform at a slightly lower price per piece." />
      <PlanForm />
      <div className="grid gap-3 md:grid-cols-3">
        {plans.map((p) => (
          <Card key={p.id}>
            <div className="flex items-center justify-between">
              <span className="font-semibold">{p.name}</span>
              {p.active ? <Badge tone="green">Live</Badge> : <Badge>Off</Badge>}
            </div>
            <div className="mt-1 text-2xl font-bold">{rupees(p.price)}</div>
            <div className="text-sm text-stone-600">{p.pieces_per_month} pcs · {rupees(Math.round((p.price / p.pieces_per_month) * 100) / 100)}/pc</div>
            <div className="text-xs text-stone-500">{p.subs} active subscribers</div>
            <form action={togglePlan} className="mt-2">
              <input type="hidden" name="plan_id" value={p.id} />
              <SubmitButton className="btn-secondary px-3 py-1.5 text-xs">{p.active ? 'Turn off' : 'Turn on'}</SubmitButton>
            </form>
          </Card>
        ))}
      </div>
    </div>
  )
}
