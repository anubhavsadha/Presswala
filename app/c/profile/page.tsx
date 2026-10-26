import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui'
import { requireRole } from '@/lib/auth'
import { getHousehold, listAreas } from '@/lib/data'
import { ProfileForm } from './ProfileForm'

export const metadata = { title: 'Profile' }

export default async function Profile() {
  const s = await requireRole('customer')
  const h = await getHousehold(s.uid)
  if (!h) redirect('/login')
  const areas = await listAreas()
  return (
    <div>
      <PageHeader title="Profile" subtitle={`+91 ${h.phone}`} />
      <ProfileForm household={{ name: h.name, area_id: h.area_id, address: h.address, landmark: h.landmark, lat: h.lat, lng: h.lng }}
        areas={areas.map((a) => ({ id: a.id, name: a.name }))} />
    </div>
  )
}
