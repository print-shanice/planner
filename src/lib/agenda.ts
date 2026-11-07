import type { Place, Stop, Trip } from './types'
import type { DayEntry } from './dates'
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
    if (stop.day === day) entries.push({ kind: 'stop', stop })
    else if (stop.kind === 'stay' && stop.day < day && stop.end_date && stop.end_date >= day) {
      entries.push({ kind: stop.end_date === day ? 'checkout' : 'staying', stop })
    }
  }
  return entries.sort((a, b) => {
    const context = Number(a.kind === 'stop') - Number(b.kind === 'stop')
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
