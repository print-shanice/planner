import type { Stop, Trip } from './types'
import { ancestors, descendants } from './countries'
import { dayOrder, renumber } from './dayOrder'

// after a line's time (or day) changes, the order the day now shows is written into the positions,
// so the line stays where it is when its time is cleared later. the whole family's lines that day count:
// a side trip's day and its parent's lines on it read as one day
export function settleDay(top: Trip, trips: Trip[], stops: Stop[], changed: Stop): { id: string; position: number }[] {
  if (!changed.day) return []
  const root = ancestors(changed.trip_id, trips)[0] ?? trips.find((t) => t.id === changed.trip_id) ?? top
  const family = new Set(descendants(root.id, trips))
  // an untimed check-in isn't placed by hand (it ends the day), so it keeps no position among the lines
  const all = stops.some((s) => s.id === changed.id) ? stops.map((s) => (s.id === changed.id ? changed : s)) : [...stops, changed]
  const lines = all
    .filter((s) => family.has(s.trip_id) && s.day === changed.day && (s.kind !== 'stay' || !!s.time))
  return renumber(dayOrder(lines))
}
