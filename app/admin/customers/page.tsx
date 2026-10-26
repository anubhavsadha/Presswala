import { toggleUser } from '@/app/actions/admin'
import { SubmitButton } from '@/components/SubmitButton'
import { Badge, Card, PageHeader } from '@/components/ui'
import { requireRole } from '@/lib/auth'
import { sql } from '@/lib/db'

export const metadata = { title: 'Households' }

export default async function AdminCustomers({ searchParams }: PageProps<'/admin/customers'>) {
  await requireRole('admin')
  const q = await searchParams
  const term = typeof q.q === 'string' ? q.q.trim().slice(0, 50) : ''
  const rows = await sql<{ user_id: number; name: string; phone: string; address: string; area_name: string; pw_name: string | null; active: boolean; orders: number }[]>`
    SELECT h.user_id, u.name, u.phone, h.address, a.name AS area_name, pu.name AS pw_name, u.active,
      (SELECT count(*) FROM orders o WHERE o.customer_id = h.user_id AND o.status <> 'cancelled')::int AS orders
    FROM households h JOIN users u ON u.id = h.user_id JOIN areas a ON a.id = h.area_id
    LEFT JOIN users pu ON pu.id = h.presswala_id
    WHERE ${term ? sql`(u.name ILIKE ${'%' + term + '%'} OR u.phone LIKE ${'%' + term + '%'} OR a.name ILIKE ${'%' + term + '%'})` : sql`TRUE`}
    ORDER BY u.created_at DESC LIMIT 300`
  return (
    <div className="space-y-4">
      <PageHeader title="Households" />
      <form><input name="q" defaultValue={term} placeholder="Search name, phone or area" className="input" /></form>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-stone-500">
              <tr><th className="py-1">Name</th><th>Phone</th><th>Address</th><th>Presswala</th><th>Orders</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id} className="border-t border-stone-100">
                  <td className="py-1.5 font-medium">{r.name}{!r.active && <span className="ml-1"><Badge tone="red">Off</Badge></span>}</td>
                  <td>{r.phone}</td>
                  <td>{r.address}, {r.area_name}</td>
                  <td>{r.pw_name ?? <Badge tone="amber">None</Badge>}</td>
                  <td>{r.orders}</td>
                  <td className="text-right">
                    <form action={toggleUser}>
                      <input type="hidden" name="user_id" value={r.user_id} />
                      <SubmitButton className="btn-ghost px-2 py-1 text-xs">{r.active ? 'Disable' : 'Enable'}</SubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
