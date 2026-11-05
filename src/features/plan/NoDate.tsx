import type { Place, Stop, Trip } from '../../lib/types'
import { StopRow } from './StopRow'
import { AddPlaceField } from './AddPlaceField'
import { hasPoint } from '../../lib/walk'

type Props = { trip: Trip; stops: Stop[]; canAdd: boolean; onOpen?: (s: Stop) => void; onAddPlace: (p: Place, date: null) => void }

export function NoDate({ trip, stops, canAdd, onOpen, onAddPlace }: Props) {
  if (!stops.length && !canAdd) return null
  return (
    <section className="day" aria-label="no date">
      <header className="day-head"><h3 className="head">no date</h3></header>
      <div className="day-body">
        {stops.map((s) => <StopRow key={s.id} stop={s} variant="stop" colorIndex={0} onOpen={onOpen} />)}
        {canAdd && <AddPlaceField near={hasPoint(trip.base) ? { lat: trip.base.lat!, lng: trip.base.lng! } : null} onPick={(p) => onAddPlace(p, null)} />}
      </div>
    </section>
  )
}
