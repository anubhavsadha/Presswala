'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function NavLink({ href, label, icon, exact, variant }: {
  href: string; label: string; icon: string; exact?: boolean; variant: 'top' | 'bottom'
}) {
  const path = usePathname()
  const active = exact ? path === href : path === href || path.startsWith(href + '/')
  if (variant === 'top') {
    return (
      <Link href={href} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${active ? 'bg-brand-50 text-brand-700' : 'text-stone-600 hover:bg-stone-100'}`}>
        {label}
      </Link>
    )
  }
  return (
    <Link href={href} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${active ? 'text-brand-700' : 'text-stone-500'}`}>
      <span className="text-lg leading-none" aria-hidden>{icon}</span>
      {label}
    </Link>
  )
}
