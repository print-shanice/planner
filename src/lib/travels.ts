import type { Place, Review, Stop, Trip } from './types'
import { countryName, firstVisits } from './countries'

// what the travels scrapbook shows. only what has happened counts: a journey once its day has come,
// a country once you've been (the globe's own rule)

export type LngLat = [number, number]
export type Route = { id: string; tripId: string; mode: Stop['mode']; from: string; to: string; day: string; line: [LngLat, LngLat] | null }

const EARTH = 40075
const at = (p: Place | null): LngLat | null =>
  p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat!) <= 90 && Math.abs(p.lng!) <= 180 ? [p.lng!, p.lat!] : null

// the straight line over the earth, in km
export function km(a: LngLat, b: LngLat): number {
  const r = (d: number) => (d * Math.PI) / 180
  const dLat = r(b[1] - a[1])
  const dLng = r(b[0] - a[0])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a[1])) * Math.cos(r(b[1])) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)))
}

const nameOf = (p: Place | null) => (p?.city || p?.name || '').toLowerCase()

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

export type Stamp = { code: string; name: string; first: string; color: number; tripId: string }

export function stamps(trips: Trip[], stops: Stop[], today: string): Stamp[] {
  const byId = new Map(trips.map((t) => [t.id, t]))
  return firstVisits(trips, stops, today).map((v) => ({
    code: v.code, name: countryName(v.code).toLowerCase(), first: v.when, color: byId.get(v.tripId)?.color ?? 0, tripId: v.tripId,
  }))
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
