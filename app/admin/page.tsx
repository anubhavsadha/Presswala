import Link from 'next/link'
import { Card, PageHeader, Stat } from '@/components/ui'
import { requireRole } from '@/lib/auth'
import { rupees } from '@/lib/billing'
import { addDays, todayIST } from '@/lib/dates'
import { sql } from '@/lib/db'
import { CommissionForm } from './CommissionForm'
import { getSettings } from '@/lib/data'

export default async function AdminHome() {
  await requireRole('admin')
  const today = todayIST()
  const monthStart = today.slice(0, 8) + '01'
  const [[k], areaRows, settings] = await Promise.all([
    sql<{ homes: number; presswalas: number; pending: number; today_orders: number; month_gmv: number; month_fee: number; subs: number; unserved: number; week_orders: number }[]>`
      SELECT
        (SELECT count(*) FROM households)::int AS homes,
        (SELECT count(*) FROM presswalas WHERE verified)::int AS presswalas,
        (SELECT count(*) FROM presswalas WHERE NOT verified)::int AS pending,
        (SELECT count(*) FROM orders WHERE service_date = ${today} AND status <> 'cancelled')::int AS today_orders,
        (SELECT count(*) FROM orders WHERE service_date BETWEEN ${addDays(today, -6)} AND ${today} AND status <> 'cancelled')::int AS week_orders,
        (SELECT COALESCE(sum(total), 0) FROM orders WHERE service_date >= ${monthStart} AND status IN ('picked_up','ready','delivered'))::float
          + (SELECT COALESCE(sum(price), 0) FROM subscriptions WHERE start_date >= ${monthStart} AND status <> 'cancelled')::float AS month_gmv,
        (SELECT COALESCE(sum(commission), 0) FROM orders WHERE service_date >= ${monthStart} AND status IN ('picked_up','ready','delivered'))::float
          + (SELECT COALESCE(sum(commission), 0) FROM subscriptions WHERE start_date >= ${monthStart} AND status <> 'cancelled')::float AS month_fee,
        (SELECT count(*) FROM subscriptions WHERE status = 'active')::int AS subs,
        (SELECT count(*) FROM households WHERE presswala_id IS NULL)::int AS unserved`,
    // Demand vs supply per area: where to recruit presswalas next.
    sql<{ id: number; name: string; homes: number; unserved: number; presswalas: number; capacity: number }[]>`
      SELECT a.id, a.name,
        (SELECT count(*) FROM households h WHERE h.area_id = a.id)::int AS homes,
        (SELECT count(*) FROM households h WHERE h.area_id = a.id AND h.presswala_id IS NULL)::int AS unserved,
        (SELECT count(*) FROM presswala_areas pa JOIN presswalas p ON p.user_id = pa.presswala_id WHERE pa.area_id = a.id AND p.verified)::int AS presswalas,
        (SELECT COALESCE(sum(p.capacity_homes - (SELECT count(*) FROM households x WHERE x.presswala_id = p.user_id)), 0)
           FROM presswala_areas pa JOIN presswalas p ON p.user_id = pa.presswala_id WHERE pa.area_id = a.id AND p.verified AND p.accepting)::int AS capacity
      FROM areas a WHERE a.active ORDER BY unserved DESC, homes DESC`,
    getSettings(),
  ])
  return (
    <div className="space-y-5">
      <PageHeader title="Overview" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Households" value={k.homes} hint={k.unserved ? `${k.unserved} without presswala` : 'All served'} />
        <Stat label="Presswalas" value={k.presswalas} hint={k.pending ? <Link href="/admin/presswalas" className="text-amber-700 underline">{k.pending} awaiting approval</Link> : 'none pending'} />
        <Stat label="Orders today" value={k.today_orders} hint={`${k.week_orders} in last 7 days`} />
        <Stat label="Active plans" value={k.subs} />
        <Stat label="GMV this month" value={rupees(Math.round(k.month_gmv))} />
        <Stat label="Platform fee this month" value={rupees(Math.round(k.month_fee))} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <h2 className="mb-2 font-semibold">Supply vs demand by area</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-stone-500">
                <tr><th className="py-1">Area</th><th>Homes</th><th>Unserved</th><th>Presswalas</th><th>Free capacity</th></tr>
              </thead>
              <tbody>
                {areaRows.map((a) => (
                  <tr key={a.id} className="border-t border-stone-100">
                    <td className="py-1.5 font-medium">{a.name}</td>
                    <td>{a.homes}</td>
                    <td className={a.unserved ? 'font-semibold text-red-600' : ''}>{a.unserved}</td>
                    <td className={a.presswalas === 0 && a.homes > 0 ? 'font-semibold text-red-600' : ''}>{a.presswalas}</td>
                    <td className={a.capacity < 10 && a.presswalas > 0 ? 'text-amber-700' : ''}>{a.capacity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-stone-500">Red rows need a presswala recruited; amber means existing presswalas are nearly full.</p>
        </Card>
        <CommissionForm commissionPct={settings.commissionPct} subscriptionCommissionPct={settings.subscriptionCommissionPct} />
      </div>
    </div>
  )
}
