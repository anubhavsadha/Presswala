// Optimisation engine. Pure functions with no imports so they can be unit-tested
// and reused from a mobile app or worker later.

export type Point = { lat: number; lng: number }

export function haversineKm(a: Point, b: Point) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function hasPoint(p: { lat: number | null; lng: number | null }): p is Point {
  return p.lat != null && p.lng != null
}

function pathKm(start: Point | null, pts: Point[]) {
  let km = 0
  let cur = start
  for (const p of pts) {
    if (cur) km += haversineKm(cur, p)
    cur = p
  }
  return km
}

// Nearest-neighbour tour followed by 2-opt improvement on an open path from `start`.
function orderWindow<T extends Point>(start: Point | null, pts: T[]): T[] {
  if (pts.length <= 1) return pts.slice()
  const remaining = pts.slice()
  const tour: T[] = []
  let cur: Point = start ?? remaining[0]
  while (remaining.length) {
    let best = 0
    let bestD = Infinity
    remaining.forEach((p, i) => {
      const d = haversineKm(cur, p)
      if (d < bestD) { bestD = d; best = i }
    })
    cur = remaining[best]
    tour.push(remaining.splice(best, 1)[0])
  }

  // 2-opt: reverse any segment that shortens the path, until no improvement.
  const dist = (a: Point | null, b: Point) => (a ? haversineKm(a, b) : 0)
  let improved = true
  let guard = 0
  while (improved && guard++ < 50) {
    improved = false
    for (let i = 0; i < tour.length - 1; i++) {
      for (let k = i + 1; k < tour.length; k++) {
        const before = i === 0 ? start : tour[i - 1]
        const after = k + 1 < tour.length ? tour[k + 1] : null
        const oldD = dist(before, tour[i]) + (after ? haversineKm(tour[k], after) : 0)
        const newD = dist(before, tour[k]) + (after ? haversineKm(tour[i], after) : 0)
        if (newD + 1e-9 < oldD) {
          const seg = tour.slice(i, k + 1).reverse()
          tour.splice(i, seg.length, ...seg)
          improved = true
        }
      }
    }
  }
  return tour
}

export type RouteStop = { lat: number | null; lng: number | null; window: number }

export type PlannedRoute<T> = {
  stops: (T & { seq: number; legKm: number })[]
  totalKm: number
  naiveKm: number // same stops in booking order: what the presswala does today
}

/**
 * Orders the day's stops. Time windows are respected (all 7–9 stops before 9–11 stops),
 * and within a window the route is the shortest path found from where the previous
 * window ended. Stops without coordinates go last in their window.
 */
export function planRoute<T extends RouteStop>(start: Point | null, stops: T[]): PlannedRoute<T> {
  const windows = [...new Set(stops.map((s) => s.window))].sort((a, b) => a - b)
  const ordered: T[] = []
  let cur = start
  for (const w of windows) {
    const inWin = stops.filter((s) => s.window === w)
    const located = inWin.filter(hasPoint) as (T & Point)[]
    const unlocated = inWin.filter((s) => !hasPoint(s))
    const tour = orderWindow(cur, located)
    ordered.push(...tour, ...unlocated)
    if (tour.length) cur = tour[tour.length - 1]
  }

  let prev = start
  const out = ordered.map((s, i) => {
    let legKm = 0
    if (hasPoint(s)) {
      if (prev) legKm = haversineKm(prev, s)
      prev = s
    }
    return { ...s, seq: i + 1, legKm: round(legKm) }
  })
  const located = (xs: T[]) => xs.filter(hasPoint) as unknown as Point[]
  return {
    stops: out,
    totalKm: round(pathKm(start, located(ordered))),
    naiveKm: round(pathKm(start, located(stops))),
  }
}

/** Google Maps direction links, split into legs of up to 9 waypoints (the URL limit). */
export function mapsLinks(start: Point | null, stops: RouteStop[]) {
  const pts = stops.filter(hasPoint) as Point[]
  const fmt = (p: Point) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`
  const links: string[] = []
  let origin = start
  for (let i = 0; i < pts.length; i += 10) {
    const chunk = pts.slice(i, i + 10)
    const dest = chunk[chunk.length - 1]
    const params = new URLSearchParams({ api: '1', destination: fmt(dest), travelmode: 'walking' })
    if (origin) params.set('origin', fmt(origin))
    if (chunk.length > 1) params.set('waypoints', chunk.slice(0, -1).map(fmt).join('|'))
    links.push(`https://www.google.com/maps/dir/?${params}`)
    origin = dest
  }
  return links
}

export type SlotLoad = { slot: string; areaId: number }

export type SlotAdvice = {
  slot: string
  booked: number
  sameArea: number
  full: boolean
  recommended: boolean
  reason: string
}

/**
 * Nudges customers into slots where the presswala is already visiting their society, so
 * pickups cluster and he walks less, while keeping every slot under its capacity.
 */
export function adviseSlots(slotIds: string[], bookings: SlotLoad[], areaId: number, capacity: number,
                            closed: string[] = []): SlotAdvice[] {
  const rows = slotIds.map((slot) => {
    const inSlot = bookings.filter((b) => b.slot === slot)
    const sameArea = inSlot.filter((b) => b.areaId === areaId).length
    const full = inSlot.length >= capacity || closed.includes(slot)
    // Same-society pickups are nearly free to add; general load is a mild penalty.
    const score = full ? -Infinity : sameArea * 3 - inSlot.length / Math.max(capacity, 1)
    return { slot, booked: inSlot.length, sameArea, full, score }
  })
  const best = rows.reduce<(typeof rows)[number] | null>(
    (b, r) => (r.score > (b?.score ?? -Infinity) ? r : b), null)
  return rows.map(({ score: _score, ...r }) => ({
    ...r,
    recommended: !!best && best.slot === r.slot && !r.full,
    reason: closed.includes(r.slot)
      ? 'Time passed'
      : r.full
        ? 'Full'
        : r.sameArea > 0
          ? `Already visiting ${r.sameArea} home${r.sameArea > 1 ? 's' : ''} near you`
          : r.booked === 0 ? 'Free' : `${capacity - r.booked} spots left`,
  }))
}

export type PresswalaCandidate = {
  id: number
  capacityHomes: number
  linkedHomes: number
  ratingSum: number
  ratingCount: number
  distanceKm: number | null
}

/**
 * Ranks presswalas serving an area. Balances quality (Bayesian-smoothed rating),
 * spare capacity (spreads households so nobody is overloaded) and distance.
 */
export function rankPresswalas<T extends PresswalaCandidate>(list: T[]) {
  const prior = 4 // assume a new presswala is a 4-star until proven otherwise
  const weight = 5
  return list
    .map((p) => {
      const rating = (p.ratingSum + prior * weight) / (p.ratingCount + weight)
      const free = Math.max(0, p.capacityHomes - p.linkedHomes)
      const freeShare = p.capacityHomes > 0 ? free / p.capacityHomes : 0
      const distPenalty = p.distanceKm == null ? 0 : Math.min(p.distanceKm, 5) / 5
      const score = full(p) ? -Infinity : rating * 20 + freeShare * 40 - distPenalty * 15
      return { ...p, rating: round(rating, 1), free, full: full(p), score }
    })
    .sort((a, b) => b.score - a.score)
}

function full(p: PresswalaCandidate) {
  return p.linkedHomes >= p.capacityHomes
}

export type DayForecast = { date: string; pieces: number; homes: number; overCapacity: boolean }

export function forecastLoad(days: { date: string; pieces: number; homes: number }[], dailyCapacity: number): DayForecast[] {
  return days.map((d) => ({ ...d, overCapacity: d.pieces > dailyCapacity }))
}

function round(n: number, dp = 2) {
  const f = 10 ** dp
  return Math.round(n * f) / f
}
