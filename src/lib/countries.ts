import type { Place, Stop, Trip } from './types'

export function descendants(id: string, trips: Trip[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const walk = (x: string) => {
    if (seen.has(x)) return
    seen.add(x)
    out.push(x)
    for (const t of trips) if (t.parent_id === x) walk(t.id)
  }
  walk(id)
  return out
}

export function ancestors(id: string, trips: Trip[]): Trip[] {
  const byId = new Map(trips.map((t) => [t.id, t]))
  const out: Trip[] = []
  const seen = new Set<string>([id])
  let cur = byId.get(id)
  while (cur?.parent_id && !seen.has(cur.parent_id)) {
    seen.add(cur.parent_id)
    cur = byId.get(cur.parent_id)
    if (cur) out.unshift(cur)
  }
  return out
}

export function isAncestor(anc: string, id: string, trips: Trip[]): boolean {
  return ancestors(id, trips).some((t) => t.id === anc)
}

function placesOf(s: Stop): Place[] {
  return [s.place, s.origin, s.destination].filter((p): p is Place => !!p)
}

const cc = (p: Place | null | undefined) => (p?.country ? p.country.toUpperCase() : null)

export function countryStatus(trips: Trip[], stops: Stop[], today: string): Map<string, 'been' | 'planned'> {
  const out = new Map<string, 'been' | 'planned'>()
  const ended = new Map(trips.map((t) => [t.id, !!t.end_date && t.end_date < today]))
  const mark = (code: string | null, been: boolean) => {
    if (!code) return
    if (been) out.set(code, 'been')
    else if (!out.has(code)) out.set(code, 'planned')
  }
  for (const t of trips) mark(cc(t.base), ended.get(t.id) ?? false)
  for (const s of stops) for (const p of placesOf(s)) mark(cc(p), ended.get(s.trip_id) ?? false)
  return out
}

export function tripsInCountry(code: string, trips: Trip[], stops: Stop[]): Trip[] {
  const ids = new Set<string>()
  for (const s of stops) if (placesOf(s).some((p) => cc(p) === code)) ids.add(s.trip_id)
  for (const t of trips) if (cc(t.base) === code && !trips.some((c) => c.parent_id === t.id && ids.has(c.id))) ids.add(t.id)
  return trips.filter((t) => ids.has(t.id)).sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''))
}

export function homeTotals(trips: Trip[], stops: Stop[]): { countries: number; cities: number; trips: number } {
  const countries = new Set<string>()
  const cities = new Set<string>()
  for (const t of trips) { const c = cc(t.base); if (c) countries.add(c) }
  for (const s of stops) for (const p of placesOf(s)) {
    const c = cc(p)
    if (c) countries.add(c)
    const city = p.city ?? (s.kind === 'journey' ? p.name : null)
    if (city) cities.add(`${city.trim().toLowerCase()}|${c ?? ''}`)
  }
  return { countries: countries.size, cities: cities.size, trips: trips.length }
}
