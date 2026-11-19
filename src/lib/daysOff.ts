import type { DayOff, Trip } from './types'
import { addDays, dayLabel, daysBetween, fmtDay, range } from './dates'
import { ownerOn } from './agenda'

// your own holidays: school breaks and free days, marked on home's month and named in the plan.
// the same rows also mark days you can't travel (exams, deadlines): `busy`, struck through on the month

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

// "sat 24 – fri 30 apr", "fri 9 apr"
function daysSpan(a: string, b: string): string {
  if (a === b) return dayLabel(a)
  const from = a.slice(0, 7) === b.slice(0, 7) ? `${fmtDay(a, { weekday: 'short' })} ${+a.slice(8)}` : dayLabel(a)
  return `${from} – ${dayLabel(b)}`
}

// "sat 24 – fri 30 apr · 7 days"
export function spanWords(a: string, b: string): string {
  const n = daysBetween(a, b) + 1
  return `${daysSpan(a, b)} · ${n === 1 ? '1 day' : `${n} days`}`
}

export const holidaysIn = (list: DayOff[]) => list.filter((o) => !o.busy)
export const busyIn = (list: DayOff[]) => list.filter((o) => o.busy)

// can't-travel days are about leaving: a side trip, or a short trip of its own. a long stay like the exchange is
// where the exams are, so it never clashes
const STAY_DAYS = 31
export function isAway(t: Trip): boolean {
  if (!t.start_date) return false
  return !!t.parent_id || daysBetween(t.start_date, t.end_date ?? t.start_date) < STAY_DAYS
}

export type Clash = { off: DayOff; from: string; to: string }

// the first run of a trip's own days (not its side trips') that lands on days you can't travel
export function clashOf(t: Trip, trips: Trip[], list: DayOff[]): Clash | null {
  const busy = busyIn(list)
  if (!busy.length || !isAway(t)) return null
  let c: Clash | null = null
  for (const d of range(t.start_date!, t.end_date ?? t.start_date!)) {
    const o = offOn(busy, d)
    const mine = !!o && ownerOn(t, trips, d).id === t.id
    if (!c) { if (mine) c = { off: o!, from: d, to: d }; continue }
    if (!mine || o !== c.off || d !== addDays(c.to, 1)) break
    c.to = d
  }
  return c
}

// "can't travel mon 14 jun · exams"
export const clashWords = (c: Clash) => `can't travel ${daysSpan(c.from, c.to)} · ${c.off.name.toLowerCase()}`
