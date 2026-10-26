import { test } from 'node:test'
import assert from 'node:assert/strict'
import { adviseSlots, mapsLinks, planRoute, rankPresswalas } from '../lib/optimize.ts'
import { computeBill } from '../lib/billing.ts'

test('planRoute respects windows and beats booking order', () => {
  const start = { lat: 28.47, lng: 77.09 }
  // Zig-zag booking order along a line: naive path goes back and forth.
  const stops = [0.01, 0.001, 0.008, 0.003, 0.006, 0.002].map((d, i) => ({
    id: i, lat: 28.47 + d, lng: 77.09, window: 0,
  }))
  stops.push({ id: 99, lat: 28.47, lng: 77.09, window: 1 })
  const r = planRoute(start, stops)
  assert.equal(r.stops.length, 7)
  assert.equal(r.stops.at(-1)!.id, 99, 'later window stays last')
  const lats = r.stops.slice(0, 6).map((s) => s.lat)
  assert.deepEqual(lats, [...lats].sort((a, b) => a - b), 'walks outward in one sweep')
  assert.ok(r.totalKm < r.naiveKm)
})

test('planRoute keeps stops without coordinates', () => {
  const r = planRoute(null, [{ lat: null, lng: null, window: 0 }, { lat: 28.4, lng: 77, window: 0 }])
  assert.equal(r.stops.length, 2)
  assert.equal(r.stops[1].lat, null)
})

test('mapsLinks splits long routes', () => {
  const stops = Array.from({ length: 23 }, (_, i) => ({ lat: 28 + i / 1000, lng: 77, window: 0 }))
  assert.equal(mapsLinks({ lat: 28, lng: 77 }, stops).length, 3)
})

test('adviseSlots prefers clustering and skips full slots', () => {
  const bookings = [
    { slot: '07-09', areaId: 2 }, { slot: '07-09', areaId: 2 },
    { slot: '09-11', areaId: 1 },
  ]
  const a = adviseSlots(['07-09', '09-11', '11-13'], bookings, 1, 10)
  assert.equal(a.find((x) => x.recommended)!.slot, '09-11')
  const b = adviseSlots(['07-09', '09-11'], bookings, 1, 1)
  assert.ok(b.find((x) => x.slot === '09-11')!.full)
  assert.equal(b.find((x) => x.recommended), undefined)
})

test('rankPresswalas spreads load and drops full ones to the end', () => {
  const r = rankPresswalas([
    { id: 1, capacityHomes: 100, linkedHomes: 95, ratingSum: 45, ratingCount: 10, distanceKm: 1 },
    { id: 2, capacityHomes: 100, linkedHomes: 20, ratingSum: 44, ratingCount: 10, distanceKm: 1 },
    { id: 3, capacityHomes: 50, linkedHomes: 50, ratingSum: 50, ratingCount: 10, distanceKm: 0 },
  ])
  assert.deepEqual(r.map((p) => p.id), [2, 1, 3])
  assert.ok(r[2].full)
})

test('computeBill applies subscription to dearest regular pieces only', () => {
  const b = computeBill([
    { code: 'regular', name: 'R', qty: 10, unitPrice: 6, isRegular: true },
    { code: 'kids', name: 'K', qty: 5, unitPrice: 4, isRegular: true },
    { code: 'saree', name: 'S', qty: 1, unitPrice: 25, isRegular: false },
  ], 12, 10)
  assert.equal(b.subtotal, 105)
  assert.equal(b.subscriptionPieces, 12)
  assert.equal(b.discount, 68)
  assert.equal(b.total, 37)
  assert.equal(b.commission, 3.7)
  assert.equal(b.pieces, 16)
})
