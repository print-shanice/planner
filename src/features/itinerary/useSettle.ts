import { useSave, useStops, useTrips } from '../../lib/queries'
import { settleDay } from '../../lib/daySettle'
import type { Stop } from '../../lib/types'
import { flash } from './flash'

// once a line's time or day has changed, the day's new order is written down (and the line lights up where it landed)
export function useSettle(): (changed: Stop) => void {
  const save = useSave('stops')
  const stops = useStops().data ?? []
  const trips = useTrips().data ?? []
  return (changed: Stop) => {
    const top = trips.find((t) => t.id === changed.trip_id)
    if (!top) return
    const changes = settleDay(top, trips, stops, changed)
    for (const c of changes) save.mutate(c)
    if (changes.some((c) => c.id === changed.id)) flash(changed.id)
  }
}
