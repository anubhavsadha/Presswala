import Link from 'next/link'
import type { ReactNode } from 'react'
import { logout } from '@/app/actions/auth'
import { NavLink } from './NavLink'

export type NavItem = { href: string; label: string; icon: string; exact?: boolean }

/** Mobile-first app frame: top bar plus bottom tab bar (tabs move to the top on wide screens). */
export function Shell({ children, nav, title, userName, wide = false }: {
  children: ReactNode; nav: NavItem[]; title: string; userName: string; wide?: boolean
}) {
  return (
    <div className="min-h-dvh pb-20 md:pb-6">
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className={`mx-auto flex items-center justify-between gap-3 px-4 py-3 ${wide ? 'max-w-6xl' : 'max-w-3xl'}`}>
          <Link href="/" className="flex items-center gap-2 font-bold">
            <span className="grid size-8 place-items-center rounded-lg bg-brand-600 text-white">P</span>
            <span>Presswala <span className="font-normal text-stone-500">· {title}</span></span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((n) => <NavLink key={n.href} {...n} variant="top" />)}
          </nav>
          <form action={logout} className="flex items-center gap-2">
            <span className="hidden text-sm text-stone-500 sm:inline">{userName}</span>
            <button className="btn-ghost px-2 py-1.5 text-xs">Log out</button>
          </form>
        </div>
      </header>
      <main className={`mx-auto px-4 py-5 ${wide ? 'max-w-6xl' : 'max-w-3xl'}`}>{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white md:hidden">
        <div className="mx-auto grid max-w-3xl" style={{ gridTemplateColumns: `repeat(${nav.length}, 1fr)` }}>
          {nav.map((n) => <NavLink key={n.href} {...n} variant="bottom" />)}
        </div>
      </nav>
    </div>
  )
}
