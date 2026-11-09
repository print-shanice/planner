import type { Stop, Trip } from './types'
import { addDays, daysBetween } from './dates'
import { descendants } from './countries'

// one rule everywhere: something is in the plan when it has a day, and an idea when it hasn't.
// older rows can say saved: true with a day; the day wins
export const isScheduled = (s: Pick<Stop, 'day'>): boolean => !!s.day

const lastOn = (stops: Stop[], tripId: string, day: string | null, not: string) =>
  Math.max(-1, ...stops.filter((s) => s.trip_id === tripId && (s.day ?? null) === day && s.id !== not).map((s) => s.position))

// the fields to send to put a stop on a day (or move it there); notes, category, tickets and links stay as they are
export function scheduleChange(s: Stop, day: string, stops: Stop[]): Partial<Stop> & { id: string } {
  const change: Partial<Stop> & { id: string } = { id: s.id, day, position: lastOn(stops, s.trip_id, day, s.id) + 1, saved: false }
  if (s.end_date && s.day) change.end_date = addDays(s.end_date, daysBetween(s.day, day))
  return change
}

// back to an idea: no day (and so no check-out or arrival date); the time is kept for when it's planned again
export function unscheduleChange(s: Stop, stops: Stop[]): Partial<Stop> & { id: string } {
  return { id: s.id, day: null, end_date: null, position: lastOn(stops, s.trip_id, null, s.id) + 1, saved: true }
}

export function unscheduled(trip: Trip, trips: Trip[], stops: Stop[]): Stop[] {
  const ids = new Set(descendants(trip.id, trips))
  return stops
    .filter((s) => ids.has(s.trip_id) && !s.day)
    .sort((a, b) => a.position - b.position || a.title.localeCompare(b.title))
}
