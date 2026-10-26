import { Shell } from '@/components/Shell'
import { requireRole } from '@/lib/auth'

export default async function CustomerLayout({ children }: LayoutProps<'/c'>) {
  const s = await requireRole('customer')
  return (
    <Shell
      title="Home"
      userName={s.name}
      nav={[
        { href: '/c', label: 'Home', icon: '🏠', exact: true },
        { href: '/c/book', label: 'Book', icon: '📅' },
        { href: '/c/orders', label: 'Orders', icon: '🧺' },
        { href: '/c/khata', label: 'Khata', icon: '📒' },
        { href: '/c/profile', label: 'Profile', icon: '👤' },
      ]}
    >
      {children}
    </Shell>
  )
}
