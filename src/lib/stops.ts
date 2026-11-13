import type { Place, Stop, StopKind } from './types'
import { asCategory } from './categories'
import { newId } from './id'

// a new stop with every field set, as the form and the plan start one
export function blankStop(kind: StopKind, tripId: string, fields: Partial<Stop> = {}): Stop {
  return {
    id: newId(), trip_id: tripId, kind, title: '', day: null, position: 0, time: null, end_date: null, end_time: null,
    place: null, mode: kind === 'journey' ? 'train' : null, origin: null, destination: null, status: 'idea', saved: false,
    url: '', ref: '', notes: '', category: null, flight: null, ...fields,
  }
}

// a found place put on a stop: the search's guess at its kind belongs on the stop (unless it has one), not inside the place
export function placeChange(stop: Pick<Stop, 'id' | 'category'>, found: Place): Partial<Stop> & { id: string } {
  const { category, ...place } = found
  return { id: stop.id, place, ...(stop.category ? {} : { category: asCategory(category) }) }
}

// a place from the map or a search as a new line of the plan (not on a day yet)
export function newPlaceStop(place: Place, tripId: string, time: string | null = null, id = newId()): Stop {
  return blankStop('place', tripId, { ...placeChange({ id, category: null }, place), title: place.name || 'dropped pin', time })
}
