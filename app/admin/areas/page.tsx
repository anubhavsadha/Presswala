import { toggleArea } from '@/app/actions/admin'
import { SubmitButton } from '@/components/SubmitButton'
import { Badge, Card, PageHeader } from '@/components/ui'
import { requireRole } from '@/lib/auth'
import { listAreas } from '@/lib/data'
import { AreaForm } from './AreaForm'

export const metadata = { title: 'Areas' }

export default async function AdminAreas() {
  await requireRole('admin')
  const areas = await listAreas(false)
  return (
    <div className="space-y-4">
      <PageHeader title="Areas" subtitle="Sectors, societies and colonies. Households pick one; presswalas serve several." />
      <AreaForm />
      <Card>
        <ul className="divide-y divide-stone-100">
          {areas.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <div>
                <span className="font-medium">{a.name}</span> <span className="text-stone-500">{a.locality}</span>
                {!a.active && <span className="ml-2"><Badge tone="red">Hidden</Badge></span>}
                <div className="text-xs text-stone-400">{a.lat != null ? `${a.lat.toFixed(4)}, ${a.lng?.toFixed(4)}` : 'No centre point'}</div>
              </div>
              <form action={toggleArea}>
                <input type="hidden" name="area_id" value={a.id} />
                <SubmitButton className="btn-ghost px-2 py-1 text-xs">{a.active ? 'Hide' : 'Show'}</SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
