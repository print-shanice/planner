import { Link } from 'react-router-dom'
import type { Place, Stop, Trip } from '../../lib/types'
import { StopRow } from './StopRow'
import { AddPlaceField } from './AddPlaceField'
import { hasPoint } from '../../lib/walk'
import { tint } from '../../components/MonthCalendar'

type Props = {
  trip: Trip
  stops: Stop[]
  // side trips without dates; always listed so they never disappear
  sideTrips: Trip[]
  canAdd: boolean
  canEdit: boolean
  onOpen?: (s: Stop) => void
  onAddPlace: (p: Place, date: null) => void
  onSetDates: (t: Trip) => void
}

export function NoDate({ trip, stops, sideTrips, canAdd, canEdit, onOpen, onAddPlace, onSetDates }: Props) {
  if (!stops.length && !canAdd && !sideTrips.length) return null
  return (
    <section className="day" aria-label="no date">
      <header className="day-head"><h3 className="head">no date</h3></header>
      <div className="day-body">
        {sideTrips.map((t) => (
          <div key={t.id} className="nodate-trip" style={tint(t.color)}>
            <Link to={`/trip/${t.id}`} className="nodate-name"><span className="dot" />{t.name}</Link>
            <button type="button" className="btn ghost small" disabled={!canEdit} onClick={() => onSetDates(t)}>set dates</button>
          </div>
        ))}
        {stops.map((s) => <StopRow key={s.id} stop={s} variant="stop" colorIndex={0} onOpen={onOpen} />)}
        {canAdd && <AddPlaceField near={hasPoint(trip.base) ? { lat: trip.base.lat!, lng: trip.base.lng! } : null} onPick={(p) => onAddPlace(p, null)} />}
      </div>
    </section>
  )
}
