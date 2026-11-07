import type { Feature, FeatureCollection, LineString, Point } from 'geojson'
import type { Place, Stop, Trip } from '../../lib/types'
import { dayColor } from '../../lib/dates'
import { agendaForDay } from '../../lib/agenda'
import { descendants } from '../../lib/countries'
import { hasPoint } from '../../lib/walk'

export type PinProps = { id: string; number: number; color: string; day: string }
export type LineProps = { kind: 'day' | 'journey'; color: string; mode?: string; day: string | null }
export type SavedProps = { id: string; saved: boolean }
export type Filter = 'all' | 'saved' | string

const xy = (p: Place): [number, number] => [p.lng!, p.lat!]
const fc = <G extends Point | LineString, P>(features: Feature<G, P>[]): FeatureCollection<G, P> => ({ type: 'FeatureCollection', features })

export function mapFeatures(trip: Trip, trips: Trip[], stops: Stop[], filter: Filter) {
  const ids = new Set(descendants(trip.id, trips))
  const pins: Feature<Point, PinProps>[] = []
  const lines: Feature<LineString, LineProps>[] = []
  const saved: Feature<Point, SavedProps>[] = []
  const showDay = (d: string) => filter === 'all' || filter === d

  const mine = stops.filter(s => ids.has(s.trip_id))
  const dates = [...new Set(mine.flatMap(s => s.day ? [s.day] : []))].sort()
  for (const date of dates) {
    if (!showDay(date)) continue
    const entries = agendaForDay(trip, trips, stops, date)
    const color = dayColor(trip.color)
    let n = 0
    const path: [number, number][] = []
    for (const e of entries) {
      if (e.kind !== 'stop' || !e.stop) continue
      n += 1
      const s = e.stop
      if (s.kind === 'journey') {
        if (hasPoint(s.origin) && hasPoint(s.destination)) lines.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [xy(s.origin), xy(s.destination)] }, properties: { kind: 'journey', color, mode: s.mode ?? 'train', day: date } })
        continue
      }
      if (!hasPoint(s.place)) continue
      pins.push({ type: 'Feature', geometry: { type: 'Point', coordinates: xy(s.place) }, properties: { id: s.id, number: n, color, day: date } })
      path.push(xy(s.place))
    }
    if (path.length > 1) lines.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: path }, properties: { kind: 'day', color, day: date } })
  }
  if (filter === 'all' || filter === 'saved') {
    for (const s of mine.filter(s => filter === 'saved' ? s.saved : !s.day)) {
      if (s.kind !== 'journey' && hasPoint(s.place)) saved.push({ type: 'Feature', geometry: { type: 'Point', coordinates: xy(s.place) }, properties: { id: s.id, saved: s.saved } })
    }
  }
  if (filter === 'saved') return { pins: fc<Point, PinProps>([]), lines: fc<LineString, LineProps>([]), saved: fc(saved) }
  return { pins: fc(pins), lines: fc(lines), saved: fc(saved) }
}

export function busyDays(trip: Trip, trips: Trip[], stops: Stop[]): string[] {
  const { pins, lines } = mapFeatures(trip, trips, stops, 'all')
  const set = new Set<string>()
  for (const f of pins.features) set.add(f.properties.day)
  for (const f of lines.features) if (f.properties.day) set.add(f.properties.day)
  return [...set].sort()
}
