import { Link } from 'react-router-dom'
import type { Trip } from '../../lib/types'
import { daysBetween, fmtRange } from '../../lib/dates'
import { CountryFlag } from '../../components/CountryFlag'
import { Icon } from '../../components/Icon'
import { Pill } from '../../components/Pill'

// a side trip's days, folded into one row in the parent's plan: they're planned inside the side trip
export function FoldRow({ trip, clash }: { trip: Trip; clash: boolean }) {
  const n = daysBetween(trip.start_date!, trip.end_date ?? trip.start_date!) + 1
  return (
    <Link id={`fold-${trip.id}`} to={`/trip/${trip.id}`} className="fold" data-testid="fold">
      <CountryFlag code={trip.base?.country} />
      <span className="fold-text">
        <span className="fold-name">{trip.name}</span>
        <span className="muted num">{`${fmtRange(trip.start_date, trip.end_date)} · ${n} ${n === 1 ? 'day' : 'days'}`}</span>
      </span>
      {clash && <Pill status="warn" label="dates clash" />}
      <span className="fold-action">open trip</span><Icon name="next" />
    </Link>
  )
}
