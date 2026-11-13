import type { Place, Review, Stop, Trip } from './types'
import { countryName, firstVisits } from './countries'
import { distanceKm } from './geo'

// what the travels scrapbook shows. only what has happened counts: a journey once its day has come,
// a country once you've been (the globe's own rule)

export type LngLat = [number, number]
export type Route = { id: string; tripId: string; mode: Stop['mode']; from: string; to: string; day: string; line: [LngLat, LngLat] | null }
// a route as the globe draws it: its two ends and how you went (a flight bends over the earth, the rest run straight)
export type GlobeRoute = { line: [LngLat, LngLat]; mode: Stop['mode'] }

const EARTH = 40075
const at = (p: Place | null): LngLat | null =>
  p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat!) <= 90 && Math.abs(p.lng!) <= 180 ? [p.lng!, p.lat!] : null

// the straight line over the earth, in km
export const km = (a: LngLat, b: LngLat): number => distanceKm({ lng: a[0], lat: a[1] }, { lng: b[0], lat: b[1] })

const nameOf = (p: Place | null) => (p?.city || p?.name || '').toLowerCase()

// the great circle from a to b as a run of points (a flight's path, bending towards the pole on a long haul)
export function arc(a: LngLat, b: LngLat, segments = 32): LngLat[] {
  const r = (d: number) => (d * Math.PI) / 180
  const deg = (x: number) => (x * 180) / Math.PI
  const [l1, f1, l2, f2] = [r(a[0]), r(a[1]), r(b[0]), r(b[1])]
  const d = 2 * Math.asin(Math.min(1, Math.sqrt(Math.sin((f2 - f1) / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin((l2 - l1) / 2) ** 2)))
  if (!(d > 1e-9)) return [a, b]
  const out: LngLat[] = [a]
  for (let i = 1; i < segments; i++) {
    const f = i / segments
    const A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d)
    const x = A * Math.cos(f1) * Math.cos(l1) + B * Math.cos(f2) * Math.cos(l2)
    const y = A * Math.cos(f1) * Math.sin(l1) + B * Math.cos(f2) * Math.sin(l2)
    const z = A * Math.sin(f1) + B * Math.sin(f2)
    out.push([deg(Math.atan2(y, x)), deg(Math.atan2(z, Math.sqrt(x * x + y * y)))])
  }
  out.push(b)
  return out
}

export function tickets(trips: Trip[], stops: Stop[], today: string): { flights: Route[]; trains: Route[]; ground: Route[]; km: number } {
  const known = new Set(trips.map((t) => t.id))
  const done = stops
    .filter((s) => s.kind === 'journey' && known.has(s.trip_id) && !!s.day && s.day <= today)
    .sort((a, b) => (a.day ?? '').localeCompare(b.day ?? '') || (a.time ?? '').localeCompare(b.time ?? ''))
  let total = 0
  const routes: Route[] = done.map((s) => {
    const a = at(s.origin)
    const b = at(s.destination)
    const line: [LngLat, LngLat] | null = a && b ? [a, b] : null
    if (line) total += km(line[0], line[1])
    return { id: s.id, tripId: s.trip_id, mode: s.mode, from: nameOf(s.origin), to: nameOf(s.destination), day: s.day!, line }
  })
  return {
    flights: routes.filter((r) => r.mode === 'flight'),
    trains: routes.filter((r) => r.mode === 'train'),
    ground: routes.filter((r) => r.mode === 'bus' || r.mode === 'ferry'),
    km: total,
  }
}

const FRACTIONS: [number, string][] = [[3 / 4, 'three quarters of'], [2 / 3, 'two thirds of'], [1 / 2, 'half'], [1 / 3, 'a third of'], [1 / 4, 'a quarter of'], [1 / 5, 'a fifth of'], [1 / 8, 'an eighth of'], [1 / 10, 'a tenth of']]

export function aroundTheWorld(total: number): string {
  if (total <= 0) return ''
  const ratio = total / EARTH
  if (ratio >= 1) return `${(Math.round(ratio * 10) / 10).toString()} times round the world`
  if (ratio < 0.1) return `${Math.max(1, Math.round(ratio * 100))}% of the way round the world`
  // the fraction nearest to it
  const [, words] = FRACTIONS.reduce((best, f) => (Math.abs(f[0] - ratio) < Math.abs(best[0] - ratio) ? f : best))
  return `about ${words} the way round the world`
}

// port and mode: where and how you first arrived (the first journey into the country), for the stamp's corner and foot
export type Stamp = { code: string; name: string; first: string; color: number; tripId: string; port: string | null; mode: Stop['mode'] }

export function stamps(trips: Trip[], stops: Stop[], today: string): Stamp[] {
  const byId = new Map(trips.map((t) => [t.id, t]))
  const cc = (p: Stop['place']) => p?.country?.toUpperCase() ?? null
  const arrivals = stops
    .filter((s) => s.kind === 'journey' && s.day && cc(s.destination) && cc(s.destination) !== cc(s.origin))
    .sort((a, b) => a.day!.localeCompare(b.day!) || (a.time ?? '').localeCompare(b.time ?? ''))
  return firstVisits(trips, stops, today).map((v) => {
    const trip = byId.get(v.tripId)
    const by = arrivals.find((s) => cc(s.destination) === v.code && s.day! <= v.when)
    const base = trip && cc(trip.base) === v.code ? trip.base : null
    const port = by ? by.destination!.name || by.destination!.city : base?.city || base?.name
    return { code: v.code, name: countryName(v.code).toLowerCase(), first: v.when, color: trip?.color ?? 0, tripId: v.tripId, port: port?.toLowerCase() || null, mode: by?.mode ?? null }
  })
}

export type Favourite = { stop: Stop; rating: number; back: boolean; code: string | null; color: number }

// places someone rated 5, then 4s someone would go back to; a place once, with its best rating
export function favourites(trips: Trip[], stops: Stop[], reviews: Review[]): Favourite[] {
  const byId = new Map(trips.map((t) => [t.id, t]))
  const best = new Map<string, { rating: number; back: boolean }>()
  for (const r of reviews) {
    if (r.rating == null) continue
    const was = best.get(r.stop_id) ?? { rating: 0, back: false }
    best.set(r.stop_id, { rating: Math.max(was.rating, r.rating), back: was.back || r.return_choice === 'yes' })
  }
  const out: Favourite[] = []
  for (const s of stops) {
    const b = best.get(s.id)
    if (!b || !(b.rating >= 5 || (b.rating >= 4 && b.back))) continue
    const p = s.place ?? s.destination ?? s.origin
    out.push({ stop: s, rating: b.rating, back: b.back, code: p?.country ? p.country.toUpperCase() : null, color: byId.get(s.trip_id)?.color ?? 0 })
  }
  return out.sort((a, b) => b.rating - a.rating || Number(b.back) - Number(a.back) || (b.stop.day ?? '').localeCompare(a.stop.day ?? ''))
}
