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

// a stretch of days drawn on the calendar: a trip, or the city you sleep in
export type Span = { id: string; name: string; start: string; end: string; color: number | null; trip?: Trip }

export function tripSpan(t: Trip): Span | null {
  if (!t.start_date) return null
  return { id: t.id, name: t.name, start: t.start_date, end: end(t), color: t.color ?? 0, trip: t }
}

const within = (s: Span, d: string) => s.start <= d && s.end >= d
const spanOrder = (a: Span, b: Span) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end) || a.name.localeCompare(b.name)

// the innermost trip on a day: a side trip (or its side trip) wins over the trip it sits in
export function innermostDay(d: string, spans: Span[], depth: (s: Span) => number): Span | undefined {
  return spans.filter((s) => within(s, d)).sort((a, b) => depth(b) - depth(a) || spanOrder(a, b))[0]
}
