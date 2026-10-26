import { PageHeader } from '@/components/ui'
import { requireRole } from '@/lib/auth'
import { getPresswala, listAreas, presswalaAreas, priceList } from '@/lib/data'
import { PriceForm, ShopForm } from './Forms'

export const metadata = { title: 'Settings' }

export default async function Settings() {
  const s = await requireRole('presswala')
  const [pw, areas, mine, prices] = await Promise.all([getPresswala(s.uid), listAreas(), presswalaAreas(s.uid), priceList(s.uid, false)])
  if (!pw) return null
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle={`+91 ${pw.phone}${pw.verified ? ' · Verified ✓' : ' · Verification pending'}`} />
      <ShopForm pw={{
        shop_name: pw.shop_name, shop_address: pw.shop_address, upi_id: pw.upi_id, capacity_homes: pw.capacity_homes,
        daily_piece_capacity: pw.daily_piece_capacity, slot_capacity: pw.slot_capacity, working_days: pw.working_days,
        accepting: pw.accepting, lat: pw.lat, lng: pw.lng,
      }} areas={areas.map((a) => ({ id: a.id, name: a.name }))} mine={mine.map((a) => a.id)} />
      <PriceForm prices={prices.map((p) => ({ id: p.id, name: p.name, price: p.price, active: p.active, is_regular: p.is_regular }))} />
    </div>
  )
}
