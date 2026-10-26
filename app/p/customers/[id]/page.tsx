import { notFound } from 'next/navigation'
import { recordPayment, reviewPayment } from '@/app/actions/presswala'
import { LedgerTable } from '@/components/LedgerTable'
import { SubmitButton } from '@/components/SubmitButton'
import { Card, PageHeader } from '@/components/ui'
import { requireRole } from '@/lib/auth'
import { rupees } from '@/lib/billing'
import { activeSubscription, balance, ledger } from '@/lib/data'
import { sql } from '@/lib/db'

export default async function CustomerKhata({ params }: PageProps<'/p/customers/[id]'>) {
  const s = await requireRole('presswala')
  const { id } = await params
  if (!/^\d+$/.test(id)) notFound()
  const [c] = await sql<{ user_id: number; name: string; phone: string; address: string; area_name: string }[]>`
    SELECT h.user_id, u.name, u.phone, h.address, a.name AS area_name
    FROM households h JOIN users u ON u.id = h.user_id JOIN areas a ON a.id = h.area_id
    WHERE h.user_id = ${id}
      AND (h.presswala_id = ${s.uid} OR EXISTS (SELECT 1 FROM ledger_entries l WHERE l.customer_id = h.user_id AND l.presswala_id = ${s.uid}))`
  if (!c) notFound()
  const [bal, entries, sub] = await Promise.all([balance(c.user_id, s.uid), ledger(c.user_id, s.uid), activeSubscription(c.user_id)])

  return (
    <div className="space-y-4">
      <PageHeader title={c.address} subtitle={`${c.name} · ${c.area_name}`} back="/p/customers"
        action={<a href={`tel:${c.phone}`} className="btn-secondary px-3 py-1.5 text-sm">📞 Call</a>} />
      <Card>
        <div className="text-sm text-stone-500">To collect · लेना है</div>
        <div className={`text-3xl font-extrabold ${bal.owed > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{rupees(Math.max(0, bal.owed))}</div>
        {bal.owed < 0 && <div className="text-sm text-emerald-700">Advance: {rupees(-bal.owed)}</div>}
        {sub && sub.presswala_id === s.uid && <div className="mt-1 text-sm text-stone-600">{sub.plan_name} plan · {sub.pieces_total - sub.pieces_used} pieces left</div>}
        <form action={recordPayment} className="mt-3 flex gap-2">
          <input type="hidden" name="customer_id" value={c.user_id} />
          <input name="amount" type="number" min="1" step="1" defaultValue={bal.owed > 0 ? Math.round(bal.owed) : ''} placeholder="₹" className="input w-28" aria-label="Amount" required />
          <select name="method" className="input w-24" aria-label="Method"><option value="cash">Cash</option><option value="upi">UPI</option></select>
          <SubmitButton className="btn-primary flex-1">Got paid · मिला</SubmitButton>
        </form>
      </Card>
      <Card>
        <h2 className="mb-1 font-semibold">Khata</h2>
        <LedgerTable entries={entries} actions={(e) => e.kind === 'payment' && !e.confirmed ? (
          <div className="flex gap-1">
            <form action={reviewPayment}>
              <input type="hidden" name="entry_id" value={e.id} /><input type="hidden" name="decision" value="confirm" />
              <button className="btn-primary px-2 py-1 text-xs">Confirm</button>
            </form>
            <form action={reviewPayment}>
              <input type="hidden" name="entry_id" value={e.id} /><input type="hidden" name="decision" value="reject" />
              <button className="btn-danger px-2 py-1 text-xs">Not received</button>
            </form>
          </div>
        ) : null} />
      </Card>
    </div>
  )
}
