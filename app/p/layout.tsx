import { Shell } from '@/components/Shell'
import { requireRole } from '@/lib/auth'

export default async function PresswalaLayout({ children }: LayoutProps<'/p'>) {
  const s = await requireRole('presswala')
  return (
    <Shell
      title="Presswala"
      userName={s.name}
      nav={[
        { href: '/p', label: 'Today', icon: '🗺️', exact: true },
        { href: '/p/orders', label: 'Orders', icon: '🧺' },
        { href: '/p/customers', label: 'Customers', icon: '👥' },
        { href: '/p/earnings', label: 'Earnings', icon: '💰' },
        { href: '/p/settings', label: 'Settings', icon: '⚙️' },
      ]}
    >
      {children}
    </Shell>
  )
}
