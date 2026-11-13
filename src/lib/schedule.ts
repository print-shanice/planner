import type { Stop, Trip } from './types'
import { addDays, daysBetween } from './dates'
import { descendants } from './countries'

// the position after the last of a trip's lines on that day (null: its ideas), leaving out the one being placed
export const nextPosition = (stops: Stop[], tripId: string, day: string | null, not?: string): number =>
  Math.max(-1, ...stops.filter((s) => s.trip_id === tripId && (s.day ?? null) === day && s.id !== not).map((s) => s.position)) + 1

// the fields to send to put a stop on a day (or move it there); notes, category, tickets and links stay as they are
export function scheduleChange(s: Stop, day: string, stops: Stop[]): Partial<Stop> & { id: string } {
  const change: Partial<Stop> & { id: string } = { id: s.id, day, position: nextPosition(stops, s.trip_id, day, s.id), saved: false }
  if (s.end_date && s.day) change.end_date = addDays(s.end_date, daysBetween(s.day, day))
  return change
}

// one rule everywhere: something is in the plan when it has a day, and an idea when it hasn't.
// older rows can say saved: true with a day; the day wins
export function unscheduled(trip: Trip, trips: Trip[], stops: Stop[]): Stop[] {
  const ids = new Set(descendants(trip.id, trips))
  return stops
    .filter((s) => ids.has(s.trip_id) && !s.day)
    .sort((a, b) => a.position - b.position || a.title.localeCompare(b.title))
}
