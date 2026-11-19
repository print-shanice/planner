import type { DayOff } from './types'
import { dayLabel, daysBetween, fmtDay } from './dates'

// your own holidays: school breaks and free days, marked on home's month and named in the plan

const byStart = (a: DayOff, b: DayOff) => a.start_date.localeCompare(b.start_date) || a.end_date.localeCompare(b.end_date)

// the holiday a day is in; when two overlap, the one that started first
export function offOn(list: DayOff[], d: string): DayOff | undefined {
  return list.filter((o) => o.start_date <= d && o.end_date >= d).sort(byStart)[0]
}

// "spring break · day 4 of 7"; a one-day holiday is just its name
export function offWords(o: DayOff, d: string): string {
  const name = o.name.toLowerCase()
  const total = daysBetween(o.start_date, o.end_date) + 1
  return total === 1 ? name : `${name} · day ${daysBetween(o.start_date, d) + 1} of ${total}`
}

// the holidays touching from..to (a month), by when they start
export function offBetween(list: DayOff[], from: string, to: string): DayOff[] {
  return list.filter((o) => o.start_date <= to && o.end_date >= from).sort(byStart)
}

export type Picked = [string, string | null] | null

// marking days on the month: the first tap starts, the second ends (either way round), a third starts again
export function pickDays(picked: Picked, d: string): Picked {
  if (!picked || picked[1]) return [d, null]
  const a = picked[0]
  return a <= d ? [a, d] : [d, a]
}

// "sat 24 – fri 30 apr · 7 days"
export function spanWords(a: string, b: string): string {
  const n = daysBetween(a, b) + 1
  if (a === b) return `${dayLabel(a)} · 1 day`
  const from = a.slice(0, 7) === b.slice(0, 7) ? `${fmtDay(a, { weekday: 'short' })} ${+a.slice(8)}` : dayLabel(a)
  return `${from} – ${dayLabel(b)} · ${n} days`
}
