import type { Place, Stop, Trip } from './types'
import { tripDays, type DayEntry } from './dates'
import { descendants } from './countries'

export function validDay(day: string | null): day is string {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false
  const date = new Date(`${day}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day
}

export const agendaOrder = (a: Stop, b: Stop) =>
  (a.time ?? '99').localeCompare(b.time ?? '99') || a.position - b.position || a.id.localeCompare(b.id)

export function agendaForDay(trip: Trip, trips: Trip[], stops: Stop[], day: string): DayEntry[] {
  const ids = new Set(descendants(trip.id, trips))
  const entries: DayEntry[] = []
  for (const stop of stops) {
    if (!ids.has(stop.trip_id) || !stop.day) continue
    if (stop.day === day) entries.push({ kind: stop.kind === 'stay' ? 'checkin' : 'stop', stop })
    else if (stop.kind === 'stay' && stop.day < day && stop.end_date && stop.end_date >= day) {
      entries.push({ kind: stop.end_date === day ? 'checkout' : 'staying', stop })
    }
  }
  return entries.sort((a, b) => {
    const inline = (k: DayEntry['kind']) => k === 'stop' || k === 'checkin'
    const context = Number(inline(a.kind)) - Number(inline(b.kind))
    return context || agendaOrder(a.stop!, b.stop!)
  })
}

export function samePlace(a: Place | null, b: Place | null): boolean {
  if (!a || !b) return false
  if (a.osm_id && b.osm_id) return a.osm_id === b.osm_id
  return a.lat != null && a.lng != null && b.lat != null && b.lng != null
    && a.name.trim().toLowerCase() === b.name.trim().toLowerCase()
    && Math.abs(a.lat - b.lat) < 0.0001 && Math.abs(a.lng - b.lng) < 0.0001
}

// the day a trip's plan (and the laptop map beside it) shows: the link's day if it can open,
// else today while the trip is on, else its first day (or its first planned day without dates)
export function chosenDay(trip: Trip, trips: Trip[], stops: Stop[], requested: string | null, today: string): string | null {
  const all = tripDays(trip)
  const inTrip = (d: string) => all.length > 0 && d >= all[0] && d <= all[all.length - 1]
  const family = new Set(descendants(trip.id, trips))
  const planned = [...new Set(stops.filter((s) => family.has(s.trip_id) && s.day).map((s) => s.day!))].sort()
  const canOpen = (d: string) => !all.length || inTrip(d) || planned.includes(d)
  if (validDay(requested) && canOpen(requested)) return requested
  return inTrip(today) ? today : all[0] ?? planned[0] ?? null
}

const covers = (t: Trip, d: string) => !!t.start_date && t.start_date <= d && (t.end_date ?? t.start_date) >= d

function depth(t: Trip, trips: Trip[]): number {
  let n = 0
  for (let p = t.parent_id; p && n < 20; n++) p = trips.find((x) => x.id === p)?.parent_id ?? null
  return n
}

// the innermost trip in the family that the day belongs to
export function ownerOn(trip: Trip, trips: Trip[], date: string | null): Trip {
  if (!date) return trip
  const ids = new Set(descendants(trip.id, trips))
  return trips.filter((t) => ids.has(t.id) && covers(t, date)).sort((a, b) => depth(b, trips) - depth(a, trips))[0] ?? trip
}

// a day's entries as the plan reads them: a side trip's own bed that night replaces the parent's "staying at"
export function dayEntries(trip: Trip, trips: Trip[], stops: Stop[], date: string): DayEntry[] {
  const entries = agendaForDay(trip, trips, stops, date)
  const owner = ownerOn(trip, trips, date)
  if (owner.id === trip.id) return entries
  const inner = new Set(descendants(owner.id, trips))
  const sleepsThere = entries.some((e) => (e.kind === 'checkin' || e.kind === 'staying') && inner.has(e.stop!.trip_id))
  return sleepsThere ? entries.filter((e) => e.kind !== 'staying' || inner.has(e.stop!.trip_id)) : entries
}
