import { redirect } from 'next/navigation'
import { reportPayment } from '@/app/actions/customer'
import { LedgerTable } from '@/components/LedgerTable'
import { SubmitButton } from '@/components/SubmitButton'
import { Card, PageHeader } from '@/components/ui'
import { requireRole } from '@/lib/auth'
import { rupees, upiLink } from '@/lib/billing'
import { balance, getHousehold, getPresswala, ledger } from '@/lib/data'

export const metadata = { title: 'Khata' }

export default async function Khata() {
  const s = await requireRole('customer')
  const h = await getHousehold(s.uid)
  if (!h?.presswala_id) redirect('/c/presswala')
  const [pw, bal, entries] = await Promise.all([getPresswala(h.presswala_id), balance(s.uid, h.presswala_id), ledger(s.uid, h.presswala_id)])
  if (!pw) redirect('/c/presswala')
  const due = Math.max(0, bal.owed - bal.pending)

  return (
    <div className="space-y-4">
      <PageHeader title="Khata" subtitle={`Your account with ${pw.name}`} />
      <Card>
        <div className="text-sm text-stone-500">{bal.owed >= 0 ? 'You owe' : 'Advance with presswala'}</div>
        <div className={`text-3xl font-extrabold ${bal.owed > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{rupees(Math.abs(bal.owed))}</div>
        {bal.pending > 0 && <div className="text-sm text-amber-700">{rupees(bal.pending)} you reported paying is waiting for his confirmation.</div>}
        {due > 0 && (
          <div className="mt-3 space-y-3">
            {pw.upi_id ? (
              <a href={upiLink(pw.upi_id, pw.name, due, 'Istrify khata')} className="btn-primary w-full py-3">Pay {rupees(due)} by UPI</a>
            ) : (
              <p className="text-sm text-stone-500">Your presswala has not added a UPI ID. Pay him in cash.</p>
            )}
            <form action={reportPayment} className="flex gap-2">
              <input name="amount" type="number" step="1" min="1" defaultValue={Math.round(due)} className="input w-28" aria-label="Amount paid" />
              <select name="method" className="input w-24" aria-label="Paid by">
                <option value="upi">UPI</option>
                <option value="cash">Cash</option>
              </select>
              <SubmitButton className="btn-secondary flex-1">I have paid</SubmitButton>
            </form>
          </div>
        )}
      </Card>
      <Card>
        <h2 className="mb-1 font-semibold">History</h2>
        <LedgerTable entries={entries} />
      </Card>
    </div>
  )
}
