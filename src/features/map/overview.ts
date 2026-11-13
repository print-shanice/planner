import type { Feature, FeatureCollection, LineString } from 'geojson'
import type { Stop, Trip } from '../../lib/types'
import { byStart, fmtRange } from '../../lib/dates'
import { colourVar } from '../../lib/colors'
import { descendants } from '../../lib/countries'
import { placeOut } from '../../lib/legs'
import { hasPoint } from '../../lib/walk'
import type { LineProps } from './features'

export type SidePin = { id: string; name: string; dates: string; color: string; at: [number, number] | null }
export type Overview = { home: { name: string; at: [number, number] } | null; sides: SidePin[]; lines: FeatureCollection<LineString, LineProps> }

export const hasSideTrips = (trip: Trip, trips: Trip[]) => trips.some((t) => t.parent_id === trip.id)

function sideAt(child: Trip, trips: Trip[], stops: Stop[]): [number, number] | null {
  if (hasPoint(child.base)) return [child.base.lng, child.base.lat]
  const ids = new Set(descendants(child.id, trips))
  const pts = stops.filter((s) => ids.has(s.trip_id)).map(placeOut).filter(hasPoint)
  if (!pts.length) return null
  return [pts.reduce((a, p) => a + p.lng, 0) / pts.length, pts.reduce((a, p) => a + p.lat, 0) / pts.length]
}

// the whole trip: home, and one pin per direct side trip
export function overviewFeatures(trip: Trip, trips: Trip[], stops: Stop[]): Overview {
  const b = trip.base
  const home = hasPoint(b) ? { name: (b.city || b.name).toLowerCase(), at: [b.lng, b.lat] as [number, number] } : null
  const kids = trips.filter((t) => t.parent_id === trip.id).sort(byStart)
  const sides: SidePin[] = kids.map((c) => ({
    id: c.id,
    name: c.name.toLowerCase(),
    dates: fmtRange(c.start_date, c.end_date),
    color: colourVar(c.color),
    at: sideAt(c, trips, stops),
  }))
  const features: Feature<LineString, LineProps>[] = home
    ? sides.flatMap((s) => s.at ? [{ type: 'Feature' as const, properties: { kind: 'spoke' as const, color: 'var(--ink-3)', day: null }, geometry: { type: 'LineString' as const, coordinates: [home.at, s.at] } }] : [])
    : []
  return { home, sides, lines: { type: 'FeatureCollection', features } }
}
