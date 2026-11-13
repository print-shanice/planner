import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { Trip } from '../../lib/types'
import { TripMark } from '../../components/TripMark'
import { byStart, countdown, fmtDay, fmtRange, nights } from '../../lib/dates'
import { tint } from '../../components/MonthCalendar'
import { clockIn, hereCode, placeCode, useNow, zoneOf } from '../../lib/localTime'

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

// the sidebar's stamp, like a gallery's "ldn 02:20": what's next (or where you are now), and the clock
export function HomeStamp({ trips, today, flagsOf }: { trips: Trip[]; today: string; flagsOf: (t: Trip) => string[] }) {
  const now = useNow()
  const here = hereCode()
  const mine = clockIn(Intl.DateTimeFormat().resolvedOptions().timeZone, now)
  // the innermost trip you're on today, so a side trip in paris shows paris, not the summer around it
  const on = trips.filter((t) => countdown(t, today).kind === 'ongoing').sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''))[0]
  const zone = on ? zoneOf(on.base?.country ?? flagsOf(on)[0], on.base?.lng) : null
  const next = on ? null : leadTrip(trips, today)
  return (
    <div className="home-stamp" aria-label="where and when">
      {on && <><span>now in</span><span className="stamp-time">{on.name}</span>{zone && <span>{placeCode(on.base?.city || on.base?.name || on.name)} {clockIn(zone, now)}</span>}</>}
      {next && <><span>next</span><span className="stamp-time">{next.name}</span><span>{[when(next, today), next.start_date ? fmtDay(next.start_date, { day: 'numeric', month: 'short' }) : ''].filter(Boolean).join(' · ')}</span></>}
      <span className="stamp-gap" aria-hidden="true" />
      <span className="stamp-time" aria-label="local time">{here ? `${here} ` : ''}{mine}</span>
    </div>
  )
}

// the schedule: each trip a row (its colour, its name, its dates), and its side trips together in a band
// tinted in its colour right under it, so a side trip never reads as a trip of its own.
// a side trip's own side trips are named on it
const none = () => [] as string[]

type FamilyProps = { flagsOf?: (t: Trip) => string[]; today: string; hrefOf?: (t: Trip) => string }

export function TripFamilies({ tops, trips, keepEnded = false, ...rest }: { tops: Trip[]; trips: Trip[]; keepEnded?: boolean } & FamilyProps) {
  const kidsOf = (id: string) => trips.filter((c) => c.parent_id === id && (keepEnded || countdown(c, rest.today).kind !== 'done')).sort(byStart)
  return (
    <ul className="trip-families">
      {tops.map((t, i) => <Family key={t.id} trip={t} sides={kidsOf(t.id)} kidsOf={kidsOf} i={i} {...rest} />)}
    </ul>
  )
}

const nightsWord = (t: Trip) => { const n = nights(t.start_date, t.end_date); return n ? `${n} ${n === 1 ? 'night' : 'nights'}` : '' }

function Family({ trip: t, sides, kidsOf, today, i, flagsOf = none, hrefOf }: { trip: Trip; sides: Trip[]; kidsOf: (id: string) => Trip[]; i: number } & FamilyProps) {
  const meta = [nightsWord(t), when(t, today)].filter(Boolean).join(' · ')
  return (
    <li className="family" data-testid="trip-family" style={{ ...tint(t.color), '--i': Math.min(i, 12) } as CSSProperties}>
      <Link to={hrefOf?.(t) ?? `/trip/${t.id}`} className="trip-item family-head" data-testid="trip-item" data-depth={0}>
        <span className="swatch-sq" aria-hidden="true" />
        <span className="trip-item-name">{t.name}</span>
        <span className="fam-when num">{fmtRange(t.start_date, t.end_date) || 'no dates yet'}</span>
        <TripMark codes={flagsOf(t)} max={1} />
        {meta && <span className="fam-meta num">{meta}</span>}
      </Link>
      {sides.length > 0 && (
        <div className="family-band">
          <p className="band-label">side trips of {t.name}</p>
          <ul className="family-sides">
            {sides.map((c) => {
              const grand = kidsOf(c.id)
              return (
                <li key={c.id}>
                  <Link to={`/trip/${c.id}`} className="side-item" data-testid="side-item" style={tint(c.color)}>
                    <span className="swatch-sq" aria-hidden="true" />
                    <span className="side-name">{c.name}</span>
                    {/* read out as "paris 19 – 23 feb", then its country; drawn with the country beside the name */}
                    <span className="side-when num">{fmtRange(c.start_date, c.end_date) || 'no dates yet'}</span>
                    <TripMark codes={flagsOf(c)} />
                    {grand.length > 0 && <span className="side-grand">+ {grand.length > 2 ? `${grand.length} side trips` : grand.map((g) => g.name).join(', ')}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </li>
  )
}
