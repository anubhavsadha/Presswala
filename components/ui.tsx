import Link from 'next/link'
import type { ReactNode } from 'react'
import { STATUS_HI, STATUS_LABELS } from '@/lib/constants'

export function PageHeader({ title, subtitle, back, action }: {
  title: string; subtitle?: ReactNode; back?: string; action?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        {back && <Link href={back} className="mb-1 inline-block text-sm text-stone-500">← Back</Link>}
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        {subtitle && <div className="mt-0.5 text-sm text-stone-500">{subtitle}</div>}
      </div>
      {action}
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>
}

const STATUS_STYLE: Record<string, string> = {
  requested: 'bg-amber-100 text-amber-800',
  accepted: 'bg-sky-100 text-sky-800',
  picked_up: 'bg-violet-100 text-violet-800',
  ready: 'bg-emerald-100 text-emerald-800',
  delivered: 'bg-stone-200 text-stone-700',
  cancelled: 'bg-red-100 text-red-700',
}

export function StatusBadge({ status, hindi = false }: { status: string; hindi?: boolean }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[status] ?? ''}`}>
      {STATUS_LABELS[status] ?? status}{hindi && ` · ${STATUS_HI[status]}`}
    </span>
  )
}

export function Badge({ children, tone = 'stone' }: { children: ReactNode; tone?: 'stone' | 'green' | 'amber' | 'red' | 'brand' }) {
  const tones = {
    stone: 'bg-stone-100 text-stone-700',
    green: 'bg-emerald-100 text-emerald-800',
    amber: 'bg-amber-100 text-amber-800',
    red: 'bg-red-100 text-red-700',
    brand: 'bg-brand-100 text-brand-700',
  }
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="card p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-stone-500">{hint}</div>}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">{children}</div>
}

export function Notice({ children, tone = 'amber' }: { children: ReactNode; tone?: 'amber' | 'green' | 'red' | 'sky' }) {
  const tones = {
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    red: 'border-red-200 bg-red-50 text-red-800',
    sky: 'border-sky-200 bg-sky-50 text-sky-900',
  }
  return <div className={`rounded-xl border px-3 py-2 text-sm ${tones[tone]}`}>{children}</div>
}
