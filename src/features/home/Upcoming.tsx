import { Link } from 'react-router-dom'
import type { Trip } from '../../lib/types'
import { countdown, daysBetween, fmtRange } from '../../lib/dates'
import { descendants } from '../../lib/countries'

const tint = (t: Trip) => `var(--g${(((t.color ?? 0) % 6) + 6) % 6})`

function Strip({ trip, kids }: { trip: Trip; kids: Trip[] }) {
  if (!trip.start_date || !trip.end_date || trip.end_date <= trip.start_date) return null
  const span = daysBetween(trip.start_date, trip.end_date) + 1
  const placed = kids.filter((k) => k.start_date && k.start_date <= trip.end_date! && (k.end_date ?? k.start_date) >= trip.start_date!)
  if (!placed.length) return null
  return (
    <div className="strip" aria-hidden="true">
      {placed.map((k) => {
        const a = Math.max(0, daysBetween(trip.start_date!, k.start_date!))
        const b = Math.min(span, daysBetween(trip.start_date!, k.end_date ?? k.start_date!) + 1)
        return <span key={k.id} style={{ left: `${(a / span) * 100}%`, width: `max(4px, ${((b - a) / span) * 100}%)`, background: tint(k) }} />
      })}
    </div>
  )
}

export function TripCard({ trip, trips, today }: { trip: Trip; trips: Trip[]; today: string }) {
  const kids = trips.filter((t) => t.parent_id === trip.id)
  const cd = countdown(trip, today)
  return (
    <Link to={`/trip/${trip.id}`} className="trip-card" data-testid="trip-card">
      <div className="trip-card-top">
        <div className="stack-xs">
          <h3 className="head">{trip.name}</h3>
          <p className="muted num">{fmtRange(trip.start_date, trip.end_date)}{kids.length > 0 && <> · {kids.length} side {kids.length === 1 ? 'trip' : 'trips'}</>}</p>
        </div>
        {cd.kind === 'upcoming' && (
          <div className="countdown"><span className="num head">{cd.days}</span><span className="muted">{cd.days === 1 ? 'day' : 'days'}</span></div>
        )}
        {cd.kind === 'ongoing' && (
          <div className="countdown"><span className="num head">{cd.days}</span><span className="muted">day</span></div>
        )}
      </div>
      <Strip trip={trip} kids={kids} />
    </Link>
  )
}

export function TripRow({ trip, testId }: { trip: Trip; testId?: string }) {
  return (
    <Link to={`/trip/${trip.id}`} className="trip-row" data-testid={testId}>
      <span className="dot" style={{ background: tint(trip) }} />
      <span className="trip-row-name">{trip.name}</span>
      <span className="muted num">{fmtRange(trip.start_date, trip.end_date)}</span>
    </Link>
  )
}

export function nextSideTrips(root: Trip, trips: Trip[], today: string, n = 3): Trip[] {
  const ids = new Set(descendants(root.id, trips).filter((id) => id !== root.id))
  return trips
    .filter((t) => ids.has(t.id) && t.start_date && (t.end_date ?? t.start_date) >= today)
    .sort((a, b) => a.start_date!.localeCompare(b.start_date!))
    .slice(0, n)
}
