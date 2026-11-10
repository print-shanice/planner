import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { Trip } from '../../lib/types'
import { countdown, fmtRange, nights } from '../../lib/dates'
import { tint } from '../../components/MonthCalendar'

const byStart = (a: Trip, b: Trip) => (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999') || a.name.localeCompare(b.name)

export function when(t: Trip, today: string): string {
  const cd = countdown(t, today)
  if (cd.kind === 'upcoming') return `in ${cd.days} ${cd.days === 1 ? 'day' : 'days'}`
  if (cd.kind === 'ongoing') return 'now'
  return ''
}

// the trip you're on, else the next one with dates
export function leadTrip(trips: Trip[], today: string): Trip | null {
  const top = trips.filter((t) => !t.parent_id).sort(byStart)
  return top.find((t) => countdown(t, today).kind === 'ongoing') ?? top.find((t) => countdown(t, today).kind === 'upcoming') ?? null
}

export type Item = { trip: Trip; depth: number; parent: Trip | null }

// top trips in date order, each followed by its side trips (and theirs) that haven't ended
export function tripItems(tops: Trip[], trips: Trip[], today: string, keepEnded = false): Item[] {
  const out: Item[] = []
  const walk = (t: Trip, depth: number, parent: Trip | null) => {
    out.push({ trip: t, depth, parent })
    if (depth > 8) return
    trips.filter((c) => c.parent_id === t.id && (keepEnded || countdown(c, today).kind !== 'done')).sort(byStart).forEach((c) => walk(c, depth + 1, t))
  }
  tops.forEach((t) => walk(t, 0, null))
  return out
}

export function Lead({ trip, today, href }: { trip: Trip; today: string; href: string }) {
  const cd = countdown(trip, today)
  const n = nights(trip.start_date, trip.end_date)
  const label = cd.kind === 'ongoing' ? `now · day ${cd.days} of ${(n ?? 0) + 1}` : `next · ${when(trip, today)}`
  return (
    <section className="lead" data-testid="lead" style={tint(trip.color)} aria-label={trip.name}>
      <div className="lead-text">
        <p className="mono-label lead-when">{label}</p>
        <p className="head lead-name">{trip.name}</p>
        <p className="lead-dates num">{[fmtRange(trip.start_date, trip.end_date), n != null ? `${n} ${n === 1 ? 'night' : 'nights'}` : ''].filter(Boolean).join(' · ')}</p>
      </div>
      <Link className="text-link lead-go" to={href}>open the plan →</Link>
    </section>
  )
}

// a list on a phone (side trips tucked under their parent), tiles on a laptop (each side trip says whose it is)
export function TripList({ items, today }: { items: Item[]; today: string }) {
  return (
    <ul className="trip-list">
      {items.map(({ trip: t, depth, parent }, i) => {
        const extra = [fmtRange(t.start_date, t.end_date), when(t, today)].filter(Boolean)
        return (
          <li key={t.id} style={{ '--i': Math.min(i, 12) } as CSSProperties}>
            <Link to={`/trip/${t.id}`} className="trip-item" data-testid="trip-item" data-depth={depth} style={tint(t.color)}>
              <span className="dot" aria-hidden="true" />
              <span className="trip-item-text">
                <span className="trip-item-name">{t.name}</span>
                <span className="muted num">
                  {parent && <span className="trip-item-parent">{parent.name}{extra.length ? ' · ' : ''}</span>}
                  {extra.join(' · ')}
                </span>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
