import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { Trip } from '../../lib/types'
import { TripMark } from '../../components/TripMark'
import { countdown, fmtRange, nights } from '../../lib/dates'
import { tint } from '../../components/MonthCalendar'
import { clockIn, hereCode, placeCode, useNow, zoneOf } from '../../lib/localTime'

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

// the sidebar's stamp, like a gallery's "ldn 02:20": your own clock, and while you're away, the clock where you are
export function HomeStamp({ trips, today, flagsOf }: { trips: Trip[]; today: string; flagsOf: (t: Trip) => string[] }) {
  const now = useNow()
  const here = hereCode()
  const mine = clockIn(Intl.DateTimeFormat().resolvedOptions().timeZone, now)
  // the innermost trip you're on today, so a side trip in paris shows paris, not the summer around it
  const on = trips.filter((t) => countdown(t, today).kind === 'ongoing').sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''))[0]
  const zone = on ? zoneOf(on.base?.country ?? flagsOf(on)[0], on.base?.lng) : null
  return (
    <p className="home-stamp" aria-label="local time">
      {on && zone && <><span>now in {on.name}</span><span className="stamp-time">{placeCode(on.base?.city || on.base?.name || on.name)} {clockIn(zone, now)}</span></>}
      <span className={on && zone ? undefined : 'stamp-time'}>{here ? `${here} ` : ''}{mine}</span>
    </p>
  )
}

// one card per trip with all its side trips inside it, so a side trip never reads as a trip of its own.
// a side trip's own side trips are named on it
const none = () => [] as string[]

export function TripFamilies({ tops, trips, flagsOf = none, today, keepEnded = false }: { tops: Trip[]; trips: Trip[]; flagsOf?: (t: Trip) => string[]; today: string; keepEnded?: boolean }) {
  const kidsOf = (id: string) => trips.filter((c) => c.parent_id === id && (keepEnded || countdown(c, today).kind !== 'done')).sort(byStart)
  return (
    <ul className="trip-families">
      {tops.map((t, i) => <Family key={t.id} trip={t} sides={kidsOf(t.id)} kidsOf={kidsOf} today={today} i={i} flagsOf={flagsOf} />)}
    </ul>
  )
}

function Family({ trip: t, sides, kidsOf, today, i, flagsOf }: { trip: Trip; sides: Trip[]; kidsOf: (id: string) => Trip[]; today: string; i: number; flagsOf: (t: Trip) => string[] }) {
  const line = [fmtRange(t.start_date, t.end_date), when(t, today)].filter(Boolean).join(' · ')
  return (
    <li className="family" data-testid="trip-family" style={{ ...tint(t.color), '--i': Math.min(i, 12) } as CSSProperties}>
      <Link to={`/trip/${t.id}`} className="trip-item family-head" data-testid="trip-item" data-depth={0}>
        {/* the trip's own country; its side trips show theirs */}
        <TripMark codes={flagsOf(t)} max={1} />
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
                  <TripMark codes={flagsOf(c)} />
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
