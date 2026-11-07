import { Link } from 'react-router-dom'
import type { Stop, Trip } from '../../lib/types'
import { StopRow } from './StopRow'
import { tint } from '../../components/MonthCalendar'

type Props = {
  stops: Stop[]
  // side trips without dates; always listed so they never disappear
  sideTrips: Trip[]
  canEdit: boolean
  onOpen?: (s: Stop) => void
  onSetDates: (t: Trip) => void
}

export function NoDate({ stops, sideTrips, canEdit, onOpen, onSetDates }: Props) {
  if (!stops.length && !sideTrips.length) return null
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
      </div>
    </section>
  )
}
