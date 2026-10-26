import { rupees } from '@/lib/billing'
import type { ReactNode } from 'react'

type Entry = { id: number; kind: 'charge' | 'payment'; amount: number; method: string; note: string; confirmed: boolean; created_at: Date }

export function LedgerTable({ entries, actions }: { entries: Entry[]; actions?: (e: Entry) => ReactNode }) {
  if (!entries.length) return <p className="text-sm text-stone-500">No entries yet.</p>
  return (
    <ul className="divide-y divide-stone-100">
      {entries.map((e) => (
        <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">
              {e.kind === 'charge' ? e.note || 'Charge' : `Payment${e.method ? ` · ${e.method.toUpperCase()}` : ''}`}
            </div>
            <div className="text-xs text-stone-500">
              {e.created_at.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}
              {e.kind === 'payment' && !e.confirmed && <span className="ml-1 font-medium text-amber-700">· awaiting confirmation</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {actions?.(e)}
            <span className={`text-sm font-semibold ${e.kind === 'charge' ? 'text-stone-800' : 'text-emerald-700'}`}>
              {e.kind === 'charge' ? '' : '−'}{rupees(e.amount)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}
