// Seeds Gurgaon areas, subscription plans and the admin account.
// With SEED_DEMO=1 it also creates demo presswalas and households (password: demo1234).
// Safe to re-run: existing rows are left alone.
import bcrypt from 'bcryptjs'
import postgres from 'postgres'
import { loadEnv } from './env.mjs'
import areas from '../db/gurgaon-areas.json' with { type: 'json' }
import prices from '../db/default-prices.json' with { type: 'json' }

loadEnv()
const sql = postgres(process.env.DATABASE_URL, { onnotice: () => {} })

for (const a of areas) {
  await sql`
    INSERT INTO areas (name, locality, lat, lng) VALUES (${a.name}, ${a.locality}, ${a.lat}, ${a.lng})
    ON CONFLICT (name, city) DO NOTHING`
}
console.log(`Areas: ${areas.length}`)

const [{ count: planCount }] = await sql`SELECT count(*)::int AS count FROM plans`
if (planCount === 0) {
  await sql`
    INSERT INTO plans (name, pieces_per_month, price, description) VALUES
      ('Basic', 40, 220, 'About 3 pickups a month of 12-15 clothes. ₹5.50 a piece.'),
      ('Family', 80, 420, 'Twice a week for a family of 3-4. ₹5.25 a piece.'),
      ('Large family', 120, 600, 'Three times a week, bigger households. ₹5.00 a piece.')`
  console.log('Plans: 3')
}

async function upsertUser(role, name, phone, password) {
  const hash = await bcrypt.hash(password, 10)
  const [u] = await sql`
    INSERT INTO users (role, name, phone, password_hash) VALUES (${role}, ${name}, ${phone}, ${hash})
    ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
    RETURNING id, (xmax = 0) AS created`
  return u
}

const adminPhone = process.env.ADMIN_PHONE
const adminPassword = process.env.ADMIN_PASSWORD
if (adminPhone && adminPassword) {
  await upsertUser('admin', 'Platform admin', adminPhone, adminPassword)
  console.log(`Admin: ${adminPhone}`)
}

if (process.env.SEED_DEMO === '1') {
  const areaRows = await sql`SELECT id, name, lat, lng FROM areas`
  const byName = Object.fromEntries(areaRows.map((a) => [a.name, a]))
  const demoPresswalas = [
    { name: 'Ramesh Kumar', phone: '9000000001', shop: 'Ramesh Press Point', areas: ['DLF Phase 1', 'DLF Phase 4', 'Sushant Lok 1'] },
    { name: 'Suresh Yadav', phone: '9000000002', shop: 'Suresh Iron Wala', areas: ['DLF Phase 1', 'South City 1'] },
    { name: 'Mohan Lal', phone: '9000000003', shop: 'Mohan Steam Press', areas: ['Sector 45', 'Sector 46', 'Malibu Towne'] },
  ]
  const pwIds = []
  for (const p of demoPresswalas) {
    const u = await upsertUser('presswala', p.name, p.phone, 'demo1234')
    const home = byName[p.areas[0]]
    await sql`
      INSERT INTO presswalas (user_id, shop_name, shop_address, lat, lng, upi_id, verified)
      VALUES (${u.id}, ${p.shop}, ${'Near market, ' + home.name}, ${home.lat + 0.001}, ${home.lng - 0.001},
              ${p.phone + '@upi'}, TRUE)
      ON CONFLICT (user_id) DO NOTHING`
    for (const an of p.areas) {
      await sql`INSERT INTO presswala_areas VALUES (${u.id}, ${byName[an].id}) ON CONFLICT DO NOTHING`
    }
    for (const [i, it] of prices.entries()) {
      await sql`
        INSERT INTO price_items (presswala_id, code, name, price, is_regular, sort_order)
        VALUES (${u.id}, ${it.code}, ${it.name}, ${it.price}, ${it.is_regular}, ${i})
        ON CONFLICT (presswala_id, code) DO NOTHING`
    }
    pwIds.push({ id: u.id, areas: p.areas })
  }

  // Households scattered around each area's centre, linked to a presswala serving it.
  const towers = ['A', 'B', 'C', 'D', 'E']
  let n = 0
  const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10)
  for (const pw of pwIds) {
    for (const an of pw.areas) {
      const area = byName[an]
      for (let k = 0; k < 6; k++) {
        n++
        const phone = '8' + String(100000000 + n).slice(-9)
        const u = await upsertUser('customer', `Demo Household ${n}`, phone, 'demo1234')
        if (!u.created) continue
        const lat = area.lat + (Math.random() - 0.5) * 0.008
        const lng = area.lng + (Math.random() - 0.5) * 0.008
        await sql`
          INSERT INTO households (user_id, area_id, address, lat, lng, presswala_id, linked_at)
          VALUES (${u.id}, ${area.id}, ${`House ${100 + n}, Block ${towers[k % 5]}, ${an}`}, ${lat}, ${lng}, ${pw.id}, now())`
        if (k % 2 === 0) {
          await sql`
            INSERT INTO schedules (customer_id, presswala_id, weekdays, pickup_slot, return_slot, est_pieces)
            VALUES (${u.id}, ${pw.id}, ${k % 4 === 0 ? [1, 3, 5] : [2, 4, 6]}, ${k < 3 ? '07-09' : '09-11'}, '18-20', ${8 + k * 2})`
        } else {
          await sql`
            INSERT INTO orders (customer_id, presswala_id, area_id, source, service_date, pickup_mode, pickup_slot,
                                return_mode, return_date, return_slot, est_pieces, status)
            VALUES (${u.id}, ${pw.id}, ${area.id}, 'booking', ${today}, 'doorstep', ${k === 1 ? '07-09' : '09-11'},
                    'doorstep', ${today}, ${k === 5 ? '20-22' : '18-20'}, ${10 + k}, 'requested')`
        }
      }
    }
  }
  console.log(`Demo: ${pwIds.length} presswalas (9000000001-3), ${n} households (8100000001 onwards). Password: demo1234`)
}

await sql.end()
