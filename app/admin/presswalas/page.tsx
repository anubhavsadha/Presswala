import { recordSettlement, setVerified, toggleUser } from '@/app/actions/admin'
import { SubmitButton } from '@/components/SubmitButton'
import { Badge, Card, PageHeader } from '@/components/ui'
import { requireRole } from '@/lib/auth'
import { rupees } from '@/lib/billing'
import { commissionDue } from '@/lib/data'
import { sql } from '@/lib/db'

export const metadata = { title: 'Presswalas' }

export default async function AdminPresswalas() {
  await requireRole('admin')
  const rows = await sql<{ user_id: number; name: string; phone: string; shop_name: string; shop_address: string; verified: boolean; active: boolean; accepting: boolean; capacity_homes: number; homes: number; rating_sum: number; rating_count: number; areas: string; created_at: Date }[]>`
    SELECT p.user_id, u.name, u.phone, p.shop_name, p.shop_address, p.verified, u.active, p.accepting, p.capacity_homes,
      p.rating_sum, p.rating_count, u.created_at,
      (SELECT count(*) FROM households h WHERE h.presswala_id = p.user_id)::int AS homes,
      (SELECT string_agg(a.name, ', ' ORDER BY a.name) FROM presswala_areas pa JOIN areas a ON a.id = pa.area_id WHERE pa.presswala_id = p.user_id) AS areas
    FROM presswalas p JOIN users u ON u.id = p.user_id
    ORDER BY p.verified, u.created_at DESC`
  const dues = await Promise.all(rows.map((r) => commissionDue(r.user_id)))

  return (
    <div>
      <PageHeader title="Presswalas" subtitle="Approve new sign-ups after checking their ID and stall, and collect platform fees." />
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((p, i) => (
          <Card key={p.user_id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2 font-semibold">
                  {p.name}
                  {p.verified ? <Badge tone="green">Verified</Badge> : <Badge tone="amber">Pending</Badge>}
                  {!p.active && <Badge tone="red">Disabled</Badge>}
                  {!p.accepting && <Badge>Not accepting</Badge>}
                </div>
                <div className="text-sm text-stone-500">{p.shop_name} · <a href={`tel:${p.phone}`} className="text-brand-700">{p.phone}</a></div>
                <div className="text-xs text-stone-500">{p.areas || 'No areas'}</div>
                <div className="mt-1 text-sm">{p.homes}/{p.capacity_homes} homes · ★ {p.rating_count ? (p.rating_sum / p.rating_count).toFixed(1) : '–'}</div>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <form action={setVerified}>
                  <input type="hidden" name="presswala_id" value={p.user_id} />
                  <input type="hidden" name="verified" value={p.verified ? '0' : '1'} />
                  <SubmitButton className={p.verified ? 'btn-secondary px-3 py-1.5 text-xs' : 'btn-primary px-3 py-1.5 text-xs'}>{p.verified ? 'Unverify' : 'Approve'}</SubmitButton>
                </form>
                <form action={toggleUser}>
                  <input type="hidden" name="user_id" value={p.user_id} />
                  <SubmitButton className="btn-ghost px-3 py-1.5 text-xs">{p.active ? 'Disable' : 'Enable'}</SubmitButton>
                </form>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-stone-100 pt-3 text-sm">
              <span>Fee due: <b className={dues[i].due > 0 ? 'text-red-600' : ''}>{rupees(dues[i].due)}</b> <span className="text-xs text-stone-500">of {rupees(dues[i].commission)}</span></span>
              <form action={recordSettlement} className="flex gap-1">
                <input type="hidden" name="presswala_id" value={p.user_id} />
                <input name="amount" type="number" min="1" step="1" placeholder="₹" defaultValue={dues[i].due > 0 ? Math.round(dues[i].due) : ''} className="input w-20 py-1.5 text-sm" required aria-label="Amount received" />
                <input type="hidden" name="note" value="Collected by admin" />
                <SubmitButton className="btn-secondary px-2 py-1.5 text-xs">Received</SubmitButton>
              </form>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
