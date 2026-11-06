import type { Trip } from './types'
import { addDays, countdown } from './dates'

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

const covers = (t: Trip, d: string) => !!t.start_date && t.start_date <= d && end(t) >= d

export function ribbonDay(d: string, tops: Trip[]): Trip | undefined {
  return tops.filter((t) => covers(t, d)).sort(byStart)[0]
}

export type Bar = { trip: Trip; from: number; to: number; starts: boolean; ends: boolean; lane: number }

export function weekBars(week: (string | null)[], trips: Trip[]): Bar[] {
  const lanes: number[] = [] // the last column each lane is busy until
  const out: Bar[] = []
  for (const t of trips.filter((x) => x.start_date).sort(byStart)) {
    const cols = week.flatMap((d, i) => (d && covers(t, d) ? [i] : []))
    if (!cols.length) continue
    const from = cols[0]
    const to = cols[cols.length - 1]
    let lane = lanes.findIndex((busy) => busy < from)
    if (lane < 0) lane = lanes.length
    lanes[lane] = to
    out.push({ trip: t, from, to, starts: week[from] === t.start_date, ends: week[to] === end(t), lane })
  }
  return out
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
