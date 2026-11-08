import type { Place, Stop, Trip } from './types'
import { visibleDays, type DayEntry } from './dates'
import { agendaForDay } from './agenda'
import { descendants } from './countries'

export type ItinDay = { date: string; entries: DayEntry[]; owner: Trip }
export type Itinerary = { days: ItinDay[]; undated: Stop[] }
export type Match = { id: string; date: string | null }

const covers = (t: Trip, d: string) => !!t.start_date && t.start_date <= d && (t.end_date ?? t.start_date) >= d

function depth(t: Trip, trips: Trip[]): number {
  let n = 0
  for (let p = t.parent_id; p && n < 20; n++) p = trips.find((x) => x.id === p)?.parent_id ?? null
  return n
}

// the whole trip as one doc: every listed day of the trip and its side trips, each with everything on it.
// a long trip only lists days where something starts or ends; a short side trip lists all its days
export function itineraryDays(trip: Trip, trips: Trip[], stops: Stop[]): Itinerary {
  const ids = new Set(descendants(trip.id, trips))
  const family = trips.filter((t) => ids.has(t.id))
  if (!family.some((t) => t.id === trip.id)) family.push(trip)
  const mine = stops.filter((s) => ids.has(s.trip_id) && !s.saved)
  const dates = new Set<string>()
  for (const t of family) {
    for (const d of visibleDays(t, mine.filter((s) => s.trip_id === t.id), trips.filter((c) => c.parent_id === t.id))) dates.add(d)
  }
  const days = [...dates].sort().map((date) => {
    const owner = ownerOn(trip, trips, date)
    let entries = agendaForDay(trip, trips, mine, date)
    // a side trip's own bed that night replaces the parent's "staying at"
    if (owner.id !== trip.id) {
      const inner = new Set(descendants(owner.id, trips))
      const sleepsThere = entries.some((e) => (e.kind === 'checkin' || e.kind === 'staying') && inner.has(e.stop!.trip_id))
      if (sleepsThere) entries = entries.filter((e) => e.kind !== 'staying' || inner.has(e.stop!.trip_id))
    }
    return { date, entries, owner }
  })
  const undated = mine.filter((s) => !s.day).sort((a, b) => a.position - b.position || a.title.localeCompare(b.title))
  return { days, undated }
}

// the innermost trip in the family that the day belongs to
export function ownerOn(trip: Trip, trips: Trip[], date: string | null): Trip {
  if (!date) return trip
  const ids = new Set(descendants(trip.id, trips))
  return trips.filter((t) => ids.has(t.id) && covers(t, date)).sort((a, b) => depth(b, trips) - depth(a, trips))[0] ?? trip
}

const whereOf = (s: Stop): Place | null => (s.kind === 'journey' ? s.destination : s.place)

// where a day takes you, from its places: their areas (else cities), once each
export function dayAreas(entries: DayEntry[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const e of entries) {
    if (e.kind !== 'stop' || !e.stop) continue
    const p = whereOf(e.stop)
    const name = (p?.area || p?.city || '').trim()
    if (!name || seen.has(normal(name))) continue
    seen.add(normal(name))
    out.push(name)
  }
  return out
}

export function normal(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

const fields = (s: Stop) => [
  s.title, s.place?.name, s.place?.address, s.place?.city, s.place?.area,
  s.origin?.name, s.destination?.name, s.notes, s.ref,
]

export function matchesStop(s: Stop, q: string): boolean {
  const nq = normal(q.trim())
  if (!nq) return false
  return fields(s).some((f) => !!f && normal(f).includes(nq))
}

// every matching line, in the order the doc shows them; a stay matches once, on its first listed day
export function findMatches(it: Itinerary, q: string): Match[] {
  if (!normal(q.trim())) return []
  const seen = new Set<string>()
  const out: Match[] = []
  for (const d of it.days) {
    for (const e of d.entries) {
      if (!e.stop || seen.has(e.stop.id) || !matchesStop(e.stop, q)) continue
      seen.add(e.stop.id)
      out.push({ id: e.stop.id, date: d.date })
    }
  }
  for (const s of it.undated) if (!seen.has(s.id) && matchesStop(s, q)) out.push({ id: s.id, date: null })
  return out
}

// the text split around each match, keeping its own letters (accents and case)
export function marked(text: string, q: string): { text: string; hit: boolean }[] {
  const nq = normal(q.trim())
  if (!nq) return [{ text, hit: false }]
  let norm = ''
  const at: number[] = []
  let i = 0
  for (const ch of text) {
    const n = normal(ch)
    for (let k = 0; k < n.length; k++) at.push(i)
    norm += n
    i += ch.length
  }
  const out: { text: string; hit: boolean }[] = []
  let from = 0
  let last = 0
  for (let pos = norm.indexOf(nq); pos >= 0; pos = norm.indexOf(nq, from)) {
    const start = at[pos]
    let end = at[pos + nq.length - 1]
    end += (text.codePointAt(end) ?? 0) > 0xffff ? 2 : 1
    while (end < text.length && normal(text[end]) === '') end++
    if (start > last) out.push({ text: text.slice(last, start), hit: false })
    out.push({ text: text.slice(start, end), hit: true })
    last = end
    from = pos + nq.length
  }
  if (last < text.length) out.push({ text: text.slice(last), hit: false })
  return out
}
