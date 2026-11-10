import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { Stop, Trip } from '../../lib/types'
import { tripCountries } from '../../lib/countries'
import { CountryFlag } from '../../components/CountryFlag'
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

// one card per trip with all its side trips inside it, so a side trip never reads as a trip of its own.
// a side trip's own side trips are named on it
export function TripFamilies({ tops, trips, stops = [], today, keepEnded = false }: { tops: Trip[]; trips: Trip[]; stops?: Stop[]; today: string; keepEnded?: boolean }) {
  const kidsOf = (id: string) => trips.filter((c) => c.parent_id === id && (keepEnded || countdown(c, today).kind !== 'done')).sort(byStart)
  return (
    <ul className="trip-families">
      {tops.map((t, i) => <Family key={t.id} trip={t} sides={kidsOf(t.id)} kidsOf={kidsOf} today={today} i={i} flagsOf={(x) => tripCountries(x, trips, stops)} />)}
    </ul>
  )
}

// where a trip goes, as flags; a trip with no country yet keeps its colour
function Mark({ codes }: { codes: string[] }) {
  if (!codes.length) return <span className="dot" aria-hidden="true" />
  return <span className="trip-mark">{codes.map((c) => <CountryFlag key={c} code={c} />)}</span>
}

function Family({ trip: t, sides, kidsOf, today, i, flagsOf }: { trip: Trip; sides: Trip[]; kidsOf: (id: string) => Trip[]; today: string; i: number; flagsOf: (t: Trip) => string[] }) {
  const line = [fmtRange(t.start_date, t.end_date), when(t, today)].filter(Boolean).join(' · ')
  return (
    <li className="family" data-testid="trip-family" style={{ ...tint(t.color), '--i': Math.min(i, 12) } as CSSProperties}>
      <Link to={`/trip/${t.id}`} className="trip-item family-head" data-testid="trip-item" data-depth={0}>
        {/* the trip's own country; its side trips show theirs */}
        <Mark codes={flagsOf(t).slice(0, 1)} />
        <span className="trip-item-text">
          <span className="trip-item-name">{t.name}</span>
          <span className="muted num">{line}</span>
        </span>
        {sides.length > 0 && <span className="mono-label family-count">{sides.length} side {sides.length === 1 ? 'trip' : 'trips'}</span>}
      </Link>
      {sides.length > 0 && (
        <ul className="family-sides">
          {sides.map((c) => {
            const grand = kidsOf(c.id)
            const extra = [fmtRange(c.start_date, c.end_date), when(c, today)].filter(Boolean).join(' · ')
            return (
              <li key={c.id}>
                <Link to={`/trip/${c.id}`} className="side-item" data-testid="side-item" style={tint(c.color)}>
                  <Mark codes={flagsOf(c).slice(0, 4)} />
                  <span className="trip-item-text">
                    <span className="side-name">{c.name}</span>
                    {extra && <span className="muted num">{extra}</span>}
                    {grand.length > 0 && <span className="muted side-grand">+ {grand.length > 2 ? `${grand.length} side trips` : grand.map((g) => g.name).join(', ')}</span>}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </li>
  )
}
