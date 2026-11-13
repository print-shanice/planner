import type { Place, Stop, Trip } from './types'
import { hasPoint } from './walk'
import { ancestors, descendants } from './countries'
import { normal } from './itinerary'
import { distanceKm, type Point } from './geo'

const KM = 20

// a typed line gets a place only when one is close by and plainly the same thing
export function pickGuess(title: string, results: Place[], near: Point | null): Place | null {
  const t = normal(title.trim())
  if (!t || !near) return null
  return results.find((p) => {
    const n = normal(p.name.trim())
    return !!n && hasPoint(p) && distanceKm(near, p) <= KM && (t.includes(n) || n.includes(t))
  }) ?? null
}

const point = (p: Place | null | undefined): Point | null => (hasPoint(p) ? { lat: p.lat, lng: p.lng } : null)

// where that day happens: that night's bed, else the day's last place, else the trip's base (or its parent's)
export function biasFor(trip: Trip, trips: Trip[], stops: Stop[], day: string | null): Point | null {
  const up = ancestors(trip.id, trips)
  const ids = new Set([...descendants(trip.id, trips), ...up.map((t) => t.id)])
  const mine = stops.filter((s) => ids.has(s.trip_id) && !s.saved)
  if (day) {
    // the innermost trip's bed wins: a side trip's hotel, not the exchange flat that covers the whole term
    const depth = (s: Stop) => ancestors(s.trip_id, trips).length
    const bed = mine.filter((s) => s.kind === 'stay' && s.day && hasPoint(s.place)
      && (s.day === day || (s.day < day && !!s.end_date && day < s.end_date)))
      .sort((a, b) => depth(b) - depth(a))[0]
    if (bed) return point(bed.place)
    const there = mine.filter((s) => s.day === day).map((s) => point(s.kind === 'journey' ? s.destination : s.place)).filter(Boolean)
    if (there.length) return there[there.length - 1]
  }
  for (const t of [trip, ...up.reverse()]) if (point(t.base)) return point(t.base)
  return null
}

// search results close to where you are come first; the rest keep their order
export function nearFirst(results: Place[], near: Point | null | undefined, km = 50): Place[] {
  if (!near) return results
  const close = (p: Place) => hasPoint(p) && distanceKm(near, p) <= km
  return [...results.filter(close), ...results.filter((p) => !close(p))]
}
