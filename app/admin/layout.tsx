import { Shell } from '@/components/Shell'
import { requireRole } from '@/lib/auth'

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const s = await requireRole('admin')
  return (
    <Shell
      wide
      title="Admin"
      userName={s.name}
      nav={[
        { href: '/admin', label: 'Overview', icon: '📊', exact: true },
        { href: '/admin/presswalas', label: 'Presswalas', icon: '🧑‍🔧' },
        { href: '/admin/customers', label: 'Homes', icon: '🏠' },
        { href: '/admin/areas', label: 'Areas', icon: '📍' },
        { href: '/admin/plans', label: 'Plans', icon: '💳' },
      ]}
    >
      {children}
    </Shell>
  )
}
