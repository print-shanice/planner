import { Link } from 'react-router-dom'
import type { Trip } from '../../lib/types'
import { fmtRange } from '../../lib/dates'

const tint = (t: Trip) => `var(--g${(((t.color ?? 0) % 6) + 6) % 6})`

export function TripRow({ trip, testId }: { trip: Trip; testId?: string }) {
  return (
    <Link to={`/trip/${trip.id}`} className="trip-row" data-testid={testId}>
      <span className="dot" style={{ background: tint(trip) }} />
      <span className="trip-row-name">{trip.name}</span>
      <span className="muted num">{fmtRange(trip.start_date, trip.end_date)}</span>
    </Link>
  )
}
