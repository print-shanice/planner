import type { Place, Stop, Trip } from './types'
import { addDays, countdown, tripDays, type DayEntry } from './dates'

// months are 'YYYY-MM'; days are 'YYYY-MM-DD'
export function shiftMonth(m: string, n: number): string {
  const i = +m.slice(0, 4) * 12 + (+m.slice(5, 7) - 1) + n
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`
}

// monday-first rows of seven; days outside the month are null
export function monthWeeks(m: string): (string | null)[][] {
  const first = `${m}-01`
  const lead = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7
  const cells: (string | null)[] = Array(lead).fill(null)
  for (let d = first; d.startsWith(m); d = addDays(d, 1)) cells.push(d)
  while (cells.length % 7) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7))
}

const end = (t: Trip) => t.end_date ?? t.start_date!
const byStart = (a: Trip, b: Trip) =>
  a.start_date!.localeCompare(b.start_date!) || end(b).localeCompare(end(a)) || a.name.localeCompare(b.name)

// today's month while a top-level trip is on, else the month the soonest one starts
export function openingMonth(trips: Trip[], today: string): string | null {
  const tops = trips.filter((t) => !t.parent_id && t.start_date)
  if (tops.some((t) => countdown(t, today).kind === 'ongoing')) return today.slice(0, 7)
  const next = tops.filter((t) => t.start_date! > today).sort(byStart)[0]
  return next ? next.start_date!.slice(0, 7) : null
}

// a stretch of days drawn on the calendar: a trip, or the city you sleep in
export type Span = { id: string; name: string; start: string; end: string; color: number | null; trip?: Trip }

export function tripSpan(t: Trip): Span | null {
  if (!t.start_date) return null
  return { id: t.id, name: t.name, start: t.start_date, end: end(t), color: t.color ?? 0, trip: t }
}

const within = (s: Span, d: string) => s.start <= d && s.end >= d
const spanOrder = (a: Span, b: Span) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end) || a.name.localeCompare(b.name)

export function ribbonDay(d: string, spans: Span[]): Span | undefined {
  return spans.filter((s) => within(s, d)).sort(spanOrder)[0]
}

export type Bar = { span: Span; from: number; to: number; starts: boolean; ends: boolean; lane: number }

export function weekBars(week: (string | null)[], spans: Span[]): Bar[] {
  const lanes: number[] = [] // the last column each lane is busy until
  const out: Bar[] = []
  for (const s of [...spans].sort(spanOrder)) {
    const cols = week.flatMap((d, i) => (d && within(s, d) ? [i] : []))
    if (!cols.length) continue
    const from = cols[0]
    const to = cols[cols.length - 1]
    let lane = lanes.findIndex((busy) => busy < from)
    if (lane < 0) lane = lanes.length
    lanes[lane] = to
    out.push({ span: s, from, to, starts: week[from] === s.start, ends: week[to] === s.end, lane })
  }
  return out
}

const city = (p: Place | null | undefined) => p?.city?.trim() || null

// on the trip's own days (not a side trip's): the city of that night's stay, else where a journey takes you, else the base
export function citySpans(trip: Trip, stops: Stop[], children: Trip[]): Span[] {
  const kids = children.map(tripSpan).filter((x): x is Span => !!x)
  const home = city(trip.base) ?? (trip.base?.name?.trim() || null)
  const out: Span[] = []
  for (const d of tripDays(trip)) {
    if (kids.some((k) => within(k, d))) continue
    const stay = stops.find((s) => s.kind === 'stay' && s.day && city(s.place)
      && (s.end_date && s.end_date > s.day ? s.day <= d && d < s.end_date : s.day === d))
    const journey = stops.find((s) => s.kind === 'journey' && s.day === d && city(s.destination))
    const name = city(stay?.place) ?? city(journey?.destination) ?? home
    if (!name) continue
    const last = out[out.length - 1]
    if (last && last.name === name && addDays(last.end, 1) === d) last.end = d
    else out.push({ id: `city-${d}`, name, start: d, end: d, color: null })
  }
  return out
}

export type PlanItem =
  | { kind: 'day'; date: string; entries: DayEntry[] }
  | { kind: 'fold'; date: string; trip: Trip }

// a side trip's days are planned in the side trip, so the parent shows them as one row;
// a day the parent has its own plans on (not just "staying at") still shows
export function planItems(days: { date: string; entries: DayEntry[] }[], children: Trip[]): PlanItem[] {
  const kids = children.map(tripSpan).filter((x): x is Span => !!x)
  const items: PlanItem[] = []
  for (const d of days) {
    const entries = d.entries.filter((e) => e.kind !== 'sidetrip')
    const own = entries.some((e) => e.kind !== 'staying')
    if (!own && kids.some((k) => within(k, d.date))) continue
    items.push({ kind: 'day', date: d.date, entries })
  }
  for (const k of kids) items.push({ kind: 'fold', date: k.start, trip: k.trip! })
  const rank = (i: PlanItem) => (i.kind === 'fold' ? 0 : 1)
  return items.sort((a, b) => a.date.localeCompare(b.date) || rank(a) - rank(b))
}

// every trip with a day in the month: top-level by start, each followed by its own side trips
export function monthTree(m: string, trips: Trip[]): { trip: Trip; depth: number }[] {
  const last = addDays(`${shiftMonth(m, 1)}-01`, -1)
  const shown = trips.filter((t) => t.start_date && t.start_date <= last && end(t) >= `${m}-01`).sort(byStart)
  const ids = new Set(shown.map((t) => t.id))
  const out: { trip: Trip; depth: number }[] = []
  const walk = (t: Trip, depth: number) => {
    out.push({ trip: t, depth })
    for (const k of shown) if (k.parent_id === t.id) walk(k, depth + 1)
  }
  for (const t of shown) if (!t.parent_id || !ids.has(t.parent_id)) walk(t, 0)
  return out
}
