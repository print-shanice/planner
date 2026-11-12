import type { Place, Stop } from '../../lib/types'
import { asCategory } from '../../lib/categories'
import { newId } from '../../lib/id'

// a place from the map as a new line of the plan (not on a day yet): its kind comes from the search, kept on the stop
export function newPlaceStop(place: Place, tripId: string, time: string | null = null, id = newId()): Stop {
  const { category, ...bare } = place
  return {
    id, trip_id: tripId, kind: 'place', title: place.name || 'dropped pin', day: null, position: 0, time, end_date: null, end_time: null,
    place: bare, mode: null, origin: null, destination: null, status: 'idea', saved: false, url: '', ref: '', notes: '',
    category: asCategory(category), flight: null,
  }
}
