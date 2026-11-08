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

export function countryName(code: string): string {
  try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code } catch { return code }
}

type Visit = { code: string; place: Place; city: string | null; been: boolean; when: string }

const cityOf = (p: Place, journey: boolean) => p.city ?? (journey ? p.name : null)

// a place counts as visited once its day has come; an undated stop once its trip has ended
// (but never a saved one: that's a wish, not a visit); a trip's base once the trip has started
function visits(trips: Trip[], stops: Stop[], today: string): Visit[] {
  const byId = new Map(trips.map((t) => [t.id, t]))
  const out: Visit[] = []
  const add = (p: Place, city: string | null, been: boolean, when: string) => {
    const code = cc(p)
    if (code) out.push({ code, place: p, city, been, when })
  }
  for (const t of trips) if (t.base) add(t.base, t.base.city ?? null, !!t.start_date && t.start_date <= today, t.start_date ?? '9999')
  for (const s of stops) {
    const t = byId.get(s.trip_id)
    const been = s.day ? s.day <= today : !s.saved && !!t?.end_date && t.end_date < today
    const when = s.day ?? t?.start_date ?? '9999'
    for (const p of placesOf(s)) add(p, cityOf(p, s.kind === 'journey'), been, when)
  }
  return out
}

function statusOf(all: Visit[]): Map<string, 'been' | 'planned'> {
  const out = new Map<string, 'been' | 'planned'>()
  for (const v of all) {
    if (v.been) out.set(v.code, 'been')
    else if (!out.has(v.code)) out.set(v.code, 'planned')
  }
  return out
}

export function countryStatus(trips: Trip[], stops: Stop[], today: string): Map<string, 'been' | 'planned'> {
  return statusOf(visits(trips, stops, today))
}

export type GlobePin = { code: string; name: string; status: 'been' | 'planned'; cities: string[]; lng: number; lat: number }

// maplibre throws on impossible coordinates, which would blank the whole home page
const located = (p: Place): p is Place & { lat: number; lng: number } =>
  Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat!) <= 90 && Math.abs(p.lng!) <= 180

export function globePins(trips: Trip[], stops: Stop[], today: string): GlobePin[] {
  const all = visits(trips, stops, today)
  const pins: GlobePin[] = []
  for (const [code, status] of statusOf(all)) {
    // a country you've been to only shows what you've seen there
    const mine = all
      .filter((v) => v.code === code && (status === 'planned' || v.been))
      .sort((a, b) => a.when.localeCompare(b.when))
    const seen = new Set<string>()
    const cities: string[] = []
    for (const v of mine) {
      const c = v.city?.trim()
      if (c && !seen.has(c.toLowerCase())) { seen.add(c.toLowerCase()); cities.push(c) }
    }
    const pts = mine.map((v) => v.place).filter(located)
    if (!pts.length) continue
    const lat = pts.reduce((n, p) => n + p.lat, 0) / pts.length
    const lng = pts.reduce((n, p) => n + p.lng, 0) / pts.length
    const far = (p: { lat: number; lng: number }) => (p.lat - lat) ** 2 + (p.lng - lng) ** 2
    // sit on a real place near the middle, so the pin never lands in the sea
    const at = pts.reduce((best, p) => (far(p) < far(best) ? p : best))
    pins.push({ code, name: countryName(code), status, cities, lng: at.lng, lat: at.lat })
  }
  return pins.sort((a, b) => a.code.localeCompare(b.code))
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

// the names behind the home totals, for their tooltips (lowercased, sorted)
export function homeLists(trips: Trip[], stops: Stop[]): { countries: string[]; cities: string[]; trips: string[] } {
  const countries = new Set<string>()
  const cities = new Map<string, string>()
  for (const t of trips) { const c = cc(t.base); if (c) countries.add(c) }
  for (const s of stops) for (const p of placesOf(s)) {
    const c = cc(p)
    if (c) countries.add(c)
    const city = p.city ?? (s.kind === 'journey' ? p.name : null)
    if (city) { const key = `${city.trim().toLowerCase()}|${c ?? ''}`; if (!cities.has(key)) cities.set(key, city.trim().toLowerCase()) }
  }
  const sorted = (xs: Iterable<string>) => [...xs].sort((a, b) => a.localeCompare(b))
  return {
    countries: sorted([...countries].map((c) => countryName(c).toLowerCase())),
    cities: sorted(cities.values()),
    trips: sorted(trips.map((t) => t.name.toLowerCase())),
  }
}
