import type { Feature, FeatureCollection, LineString, Point } from 'geojson'
import type { Place, Stop, Trip } from '../../lib/types'
import { dayColor } from '../../lib/dates'
import { dayEntries, ownerOn } from '../../lib/agenda'
import { ancestors, descendants } from '../../lib/countries'
import { mapBed } from '../../lib/legs'
import { distanceKm } from '../../lib/guess'
import { hasPoint } from '../../lib/walk'
import { categoryIcon, categoryOf } from '../../lib/categories'

export type PinProps = { id: string; number: number; color: string; day: string; icon: string }
export type EndProps = { id: string; color: string }
export type BedProps = { id: string }
export type NameProps = { name: string }
export type LineProps = { kind: 'day' | 'journey' | 'spoke'; color: string; mode?: string; day: string | null }
export type SavedProps = { id: string; saved: boolean; icon: string }
export type Filter = 'all' | 'saved' | string
export type MapData = {
  pins: FeatureCollection<Point, PinProps>
  ends: FeatureCollection<Point, EndProps>
  beds: FeatureCollection<Point, BedProps>
  names: FeatureCollection<Point, NameProps>
  lines: FeatureCollection<LineString, LineProps>
  saved: FeatureCollection<Point, SavedProps>
}

const xy = (p: Place): [number, number] => [p.lng!, p.lat!]
const fc = <G extends Point | LineString, P>(features: Feature<G, P>[]): FeatureCollection<G, P> => ({ type: 'FeatureCollection', features })
const pt = <P>(p: Place, properties: P): Feature<Point, P> => ({ type: 'Feature', geometry: { type: 'Point', coordinates: xy(p) }, properties })

export const EMPTY: MapData = {
  pins: fc([]), ends: fc([]), beds: fc([]), names: fc([]), lines: fc([]), saved: fc([]),
}

// ideas this near a day's pins are worth showing on it
const NEAR_KM = 10

export function mapFeatures(trip: Trip, trips: Trip[], stops: Stop[], filter: Filter): MapData {
  if (filter === 'saved') return { ...EMPTY, saved: savedOnly(trip, trips, stops) }
  const ids = new Set(descendants(trip.id, trips))
  const pins: Feature<Point, PinProps>[] = []
  const ends: Feature<Point, EndProps>[] = []
  const beds: Feature<Point, BedProps>[] = []
  const names: Feature<Point, NameProps>[] = []
  const lines: Feature<LineString, LineProps>[] = []
  const saved: Feature<Point, SavedProps>[] = []
  // a blank name would only be an empty label
  const name = (p: Place, text: string | null | undefined) => {
    const t = (text ?? '').trim()
    if (t) names.push(pt(p, { name: t.toLowerCase() }))
  }

  const mine = stops.filter(s => ids.has(s.trip_id))
  // a single day is drawn even when only its bed falls on it
  const dates = filter === 'all' ? [...new Set(mine.flatMap(s => s.day ? [s.day] : []))].sort() : [filter]
  for (const date of dates) {
    const entries = dayEntries(trip, trips, stops, date)
    const color = dayColor(ownerOn(trip, trips, date).color)
    let n = 0
    const path: [number, number][] = []
    for (const e of entries) {
      if (e.kind !== 'stop' || !e.stop) continue
      n += 1
      const s = e.stop
      if (s.kind === 'journey') {
        if (hasPoint(s.origin)) {
          pins.push(pt(s.origin, { id: s.id, number: n, color, day: date, icon: s.mode === 'flight' ? 'plane' : s.mode ?? 'train' }))
          name(s.origin, s.origin.name)
        }
        if (hasPoint(s.destination)) {
          ends.push(pt(s.destination, { id: s.id, color }))
          name(s.destination, s.destination.name)
        }
        if (hasPoint(s.origin) && hasPoint(s.destination)) lines.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [xy(s.origin), xy(s.destination)] }, properties: { kind: 'journey', color, mode: s.mode ?? 'train', day: date } })
        continue
      }
      if (!hasPoint(s.place)) continue
      pins.push(pt(s.place, { id: s.id, number: n, color, day: date, icon: categoryIcon(categoryOf(s)) }))
      name(s.place, s.title || s.place.name)
      path.push(xy(s.place))
    }
    if (path.length > 1) lines.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: path }, properties: { kind: 'day', color, day: date } })
    if (filter !== 'all') {
      const bed = mapBed(entries)
      if (bed && hasPoint(bed.place)) {
        beds.push(pt(bed.place, { id: bed.id }))
        name(bed.place, bed.title || bed.place.name)
      }
    }
  }
  if (filter === 'all') {
    for (const s of mine.filter(s => !s.day)) {
      if (s.kind !== 'journey' && hasPoint(s.place)) saved.push(pt(s.place, { id: s.id, saved: s.saved, icon: categoryIcon(categoryOf(s)) }))
    }
  } else {
    const top = ancestors(trip.id, trips)[0] ?? trip
    const family = new Set(descendants(top.id, trips))
    const onDay = new Set(pins.map(f => f.properties.id))
    const anchors = [...pins, ...ends, ...beds].map(f => ({ lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }))
    for (const s of stops) {
      const at = s.place
      if (!family.has(s.trip_id) || s.kind !== 'place' || !hasPoint(at) || onDay.has(s.id)) continue
      // ideas are the places without a day
      if (s.day) continue
      if (anchors.some(a => distanceKm(a, at) <= NEAR_KM)) saved.push(pt(at, { id: s.id, saved: s.saved, icon: categoryIcon(categoryOf(s)) }))
    }
  }
  return { pins: fc(pins), ends: fc(ends), beds: fc(beds), names: fc(names), lines: fc(lines), saved: fc(saved) }
}

function savedOnly(trip: Trip, trips: Trip[], stops: Stop[]): FeatureCollection<Point, SavedProps> {
  const ids = new Set(descendants(trip.id, trips))
  return fc(stops
    .filter(s => ids.has(s.trip_id) && !s.day && s.kind !== 'journey' && hasPoint(s.place))
    .map(s => pt(s.place!, { id: s.id, saved: s.saved, icon: categoryIcon(categoryOf(s)) })))
}

export function busyDays(trip: Trip, trips: Trip[], stops: Stop[]): string[] {
  const { pins, lines } = mapFeatures(trip, trips, stops, 'all')
  const set = new Set<string>()
  for (const f of pins.features) set.add(f.properties.day)
  for (const f of lines.features) if (f.properties.day) set.add(f.properties.day)
  return [...set].sort()
}
