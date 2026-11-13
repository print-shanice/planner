import type { Stop, Trip } from './types'
import { colourVar } from './colors'

const DAY = 86_400_000
const toMs = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10), 12)
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export function addDays(d: string, n: number): string {
  return fromMs(toMs(d) + n * DAY)
}

export function daysBetween(a: string, b: string): number {
  return Math.round((toMs(b) - toMs(a)) / DAY)
}

export function range(a: string, b: string): string[] {
  const out: string[] = []
  for (let d = a; d <= b && out.length < 2000; d = addDays(d, 1)) out.push(d)
  return out
}

export function tripDays(t: Trip): string[] {
  if (!t.start_date || !t.end_date || t.end_date < t.start_date) return []
  return range(t.start_date, t.end_date)
}

export function nights(a: string | null, b: string | null): number | null {
  if (!a || !b) return null
  return Math.max(0, daysBetween(a, b))
}

export function stayDays(s: Stop): string[] {
  if (!s.day) return []
  if (!s.end_date || s.end_date <= s.day) return [s.day]
  return range(s.day, s.end_date)
}

export type DayEntry = { kind: 'stop' | 'checkin' | 'staying' | 'checkout' | 'sidetrip'; stop?: Stop; trip?: Trip }

function stopDays(s: Stop): string[] {
  return s.kind === 'stay' ? stayDays(s) : s.day ? [s.day] : []
}

export function visibleDays(t: Trip, stops: Stop[], children: Trip[]): string[] {
  const all = tripDays(t)
  if (all.length && all.length <= 21) return all
  // a long trip lists only days with something starting or ending on them
  const set = new Set<string>()
  for (const s of stops) {
    const ds = stopDays(s)
    if (ds.length) { set.add(ds[0]); set.add(ds[ds.length - 1]) }
  }
  for (const c of children) if (c.start_date) set.add(c.start_date)
  const inTrip = (d: string) => !all.length || (d >= all[0] && d <= all[all.length - 1])
  return [...set].filter(inTrip).sort()
}

// trips in date order, the undated ones last, then by name
export const byStart = (a: Trip, b: Trip): number =>
  (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999') || a.name.localeCompare(b.name)

export function countdown(t: Trip, today: string): { kind: 'upcoming' | 'ongoing' | 'done' | 'undated'; days: number } {
  if (!t.start_date) return { kind: 'undated', days: 0 }
  if (today < t.start_date) return { kind: 'upcoming', days: daysBetween(today, t.start_date) }
  const end = t.end_date ?? t.start_date
  if (today <= end) return { kind: 'ongoing', days: daysBetween(t.start_date, today) + 1 }
  return { kind: 'done', days: 0 }
}

// a trip's colour, for its numbers and pins
export function dayColor(color: number | null | undefined): string {
  return colourVar(color)
}

export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function fmtDay(d: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }): string {
  return new Date(toMs(d)).toLocaleDateString('en-GB', { timeZone: 'UTC', ...opts }).toLowerCase()
}

// a day, short: "sat 20 feb"
export const dayLabel = (d: string): string => fmtDay(d, { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '')

export function fmtRange(a: string | null, b: string | null): string {
  if (!a) return ''
  if (!b || a === b) return fmtDay(a)
  const sameMonth = a.slice(0, 7) === b.slice(0, 7)
  return sameMonth ? `${+a.slice(8)} – ${fmtDay(b)}` : `${fmtDay(a)} – ${fmtDay(b)}`
}
