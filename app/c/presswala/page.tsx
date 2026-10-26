import { redirect } from 'next/navigation'
import { choosePresswala } from '@/app/actions/customer'
import { SubmitButton } from '@/components/SubmitButton'
import { Badge, Empty, Notice, PageHeader } from '@/components/ui'
import { requireRole } from '@/lib/auth'
import { rupees } from '@/lib/billing'
import { WEEKDAYS } from '@/lib/constants'
import { getHousehold, presswalasForArea } from '@/lib/data'
import { sql } from '@/lib/db'

export const metadata = { title: 'Choose presswala' }

export default async function ChoosePresswala({ searchParams }: PageProps<'/c/presswala'>) {
  const s = await requireRole('customer')
  const q = await searchParams
  const h = await getHousehold(s.uid)
  if (!h) redirect('/login')
  const home = h.lat != null && h.lng != null ? { lat: h.lat, lng: h.lng } : null
  const list = await presswalasForArea(h.area_id, home)
  const prices = list.length
    ? await sql<{ presswala_id: number; name: string; price: number }[]>`
        SELECT presswala_id, name, price FROM price_items
        WHERE presswala_id = ANY(${list.map((p) => p.id)}::bigint[]) AND active ORDER BY sort_order`
    : []

  return (
    <div>
      <PageHeader
        title="Presswalas in your area"
        subtitle={`Serving ${h.area_name}. Only presswalas who cover your sector are shown.`}
        back={h.presswala_id ? '/c' : undefined}
      />
      {q.moved && <div className="mb-3"><Notice>Your previous presswala does not serve your new area. Please choose one here.</Notice></div>}
      {q.error && <div className="mb-3"><Notice tone="red">That presswala is no longer available. Pick another.</Notice></div>}
      {list.length === 0 ? (
        <Empty>
          No presswala has joined in {h.area_name} yet. We have noted your interest and will onboard your local presswala soon.
          Know him? Ask him to sign up at this website as a presswala.
        </Empty>
      ) : (
        <div className="space-y-3">
          {list.map((p, i) => {
            const mine = h.presswala_id === p.id
            const rate = prices.filter((x) => x.presswala_id === p.id)
            return (
              <div key={p.id} className={`card ${mine ? 'border-brand-500 ring-2 ring-brand-100' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{p.name}</span>
                      {i === 0 && !p.full && <Badge tone="brand">Suggested</Badge>}
                      {mine && <Badge tone="green">Your presswala</Badge>}
                      {p.full && <Badge tone="red">Full</Badge>}
                    </div>
                    <div className="text-sm text-stone-500">{p.shop_name}{p.shop_address && ` · ${p.shop_address}`}</div>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-sm text-stone-600">
                      <span>★ {p.rating_count ? p.rating.toFixed(1) : 'New'}{p.rating_count ? ` (${p.rating_count})` : ''}</span>
                      {p.distanceKm != null && <span>{p.distanceKm} km away</span>}
                      <span>{p.free} spots free</span>
                      <span>{p.working_days.map((d) => WEEKDAYS[d]).join(' ')}</span>
                    </div>
                  </div>
                  {!mine && !p.full && (
                    <form action={choosePresswala}>
                      <input type="hidden" name="presswala_id" value={p.id} />
                      <SubmitButton className="btn-primary px-3 py-2">Choose</SubmitButton>
                    </form>
                  )}
                </div>
                {rate.length > 0 && (
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-brand-700">Rate card</summary>
                    <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                      {rate.map((r) => (
                        <li key={r.name} className="flex justify-between gap-2 border-b border-stone-100 py-1">
                          <span className="text-stone-600">{r.name}</span><span className="font-medium">{rupees(r.price)}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )
          })}
        </div>
      )}
      <p className="mt-4 text-xs text-stone-500">
        Suggestions balance rating, distance from your home and how busy each presswala is, so everyone gets reliable service.
      </p>
    </div>
  )
}
