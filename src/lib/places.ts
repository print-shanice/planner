import type { Place, Stop, Trip } from './types'
import { descendants } from './countries'
import { normal } from './itinerary'
import { distanceKm } from './geo'
import { hasPoint } from './walk'
import { CATEGORIES, categoryOf } from './categories'

// the places tab: every place in the trip and its side trips, planned or not (not planned yet first, then by day),
// plus stays and journeys still without a day so nothing undated is lost. notes live in notes
export function tripPlaces(trip: Trip, trips: Trip[], stops: Stop[]): Stop[] {
  const ids = new Set(descendants(trip.id, trips))
  return stops
    .filter((s) => ids.has(s.trip_id) && s.kind !== 'note' && (s.kind === 'place' || !s.day))
    .sort((a, b) => (a.day ?? '').localeCompare(b.day ?? '') || a.position - b.position || a.title.localeCompare(b.title))
}

// how close two spots with the same name have to be to count as one place (a chain elsewhere is another place)
const SAME_KM = 0.2

const nameOf = (x: { title: string; place: Place | null }) => normal((x.place?.name || x.title || '').trim())

// the place already in the list that this one would repeat: the same google place, or the same name
// in the same spot (or with no spot to tell them apart)
export function sameAs(x: { title: string; place: Place | null }, stops: Stop[]): Stop | null {
  const gid = x.place?.gid
  const name = nameOf(x)
  for (const s of stops) {
    if (gid && s.place?.gid === gid) return s
    if (!name || (nameOf(s) !== name && normal(s.title.trim()) !== name)) continue
    if (!hasPoint(x.place) || !hasPoint(s.place) || distanceKm(x.place, s.place) <= SAME_KM) return s
  }
  return null
}

export type KindFilter = (typeof CATEGORIES)[number] | 'other'

// the kind a place is filed under in the filter
export const kindOf = (s: Pick<Stop, 'kind' | 'category'>): KindFilter => {
  const c = categoryOf(s)
  return c === 'place' || c === 'note' ? 'other' : c
}

// the kinds there are, in the usual order with how many of each; "other" (nobody knows yet) last
export function kindsIn(stops: Pick<Stop, 'kind' | 'category'>[]): [KindFilter, number][] {
  const n = new Map<KindFilter, number>()
  for (const s of stops) n.set(kindOf(s), (n.get(kindOf(s)) ?? 0) + 1)
  return [...CATEGORIES, 'other' as const].filter((k) => n.has(k)).map((k) => [k, n.get(k)!])
}
