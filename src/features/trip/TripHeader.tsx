import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Stop, Trip } from '../../lib/types'
import { ancestors, countryName, descendants } from '../../lib/countries'
import { useTripFlags } from '../../lib/tripGuess'
import { fmtRange, nights, todayISO } from '../../lib/dates'
import { clockIn, diffWords, offsetOf, placeCode, useNow, zoneOf } from '../../lib/localTime'
import { tempWords, useTemps, weatherAsk } from '../../lib/weather'
import { useMembers, useStops, useTrips } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Sheet'
import { OfflineBadge } from '../../components/OfflineBadge'
import { TripForm } from '../home/TripForm'
import { TripTree } from './TripTree'
import { CountryFlag } from '../../components/CountryFlag'
import { colourVar } from '../../lib/colors'

// where the trip is, right now and when you go: "par 11:02 · same time as you · usually 9° / 3°".
// shown while the trip is still ahead or under way
function TripNow({ trip, country, stops }: { trip: Trip; country?: string; stops: Stop[] }) {
  const now = useNow()
  const today = todayISO()
  const spot = [trip.base, ...stops.filter((s) => s.trip_id === trip.id).map((s) => s.place)]
    .find((p) => p != null && Number.isFinite(p.lat) && Number.isFinite(p.lng))
  const at = spot ? { lat: spot.lat!, lng: spot.lng! } : null
  const temps = useTemps(at, weatherAsk(trip.start_date, trip.end_date, today)).data
  const zone = zoneOf(trip.base?.country ?? country, trip.base?.lng ?? spot?.lng)
  if (trip.end_date && trip.end_date < today) return null
  if (!zone && !temps) return null
  const code = placeCode(trip.base?.city || trip.base?.name || trip.name)
  return (
    <p className="trip-clock">
      {zone && <>
        <span className="trip-clock-time" aria-label={`local time ${clockIn(zone, now)}`}>{code} {clockIn(zone, now)}</span>
        <span>{diffWords(offsetOf(zone, now), -now.getTimezoneOffset())}</span>
      </>}
      {temps && <span aria-label={`${temps.kind === 'usual' ? 'usually ' : ''}highs ${temps.hi}°${temps.unit}, lows ${temps.lo}°${temps.unit}`}>{tempWords(temps)}</span>}
    </p>
  )
}

const ROUTE_MAX = 6

// a trip's countries in travelling order: its own base first, then each other country by the first day you're there
export function routeOrder(codes: string[], trip: Trip, trips: Trip[], stops: Stop[]): string[] {
  const ids = new Set(descendants(trip.id, trips))
  const first = new Map<string, string>()
  const seen = (code: string | null | undefined, day: string | null | undefined) => {
    const c = code?.toUpperCase()
    if (!c || !day) return
    if (!first.has(c) || day < first.get(c)!) first.set(c, day)
  }
  for (const t of trips) if (ids.has(t.id) && t.id !== trip.id) seen(t.base?.country, t.start_date)
  for (const s of stops) if (ids.has(s.trip_id)) { seen(s.place?.country, s.day); seen(s.destination?.country, s.end_date ?? s.day) }
  const home = trip.base?.country?.toUpperCase()
  const rest = codes.filter((c) => c !== home).sort((a, b) => (first.get(a) ?? '9999').localeCompare(first.get(b) ?? '9999'))
  return home && codes.includes(home) ? [home, ...rest] : rest
}

export function TripHeader({ trip, add, onEdit }: { trip: Trip; add?: ReactNode; onEdit: () => void }) {
  const trips = useTrips().data ?? []
  const stops = useStops().data ?? []
  const members = useMembers().data ?? []
  const canEdit = useCanEdit()
  const [tree, setTree] = useState(false)
  const [adding, setAdding] = useState(false)
  const path = ancestors(trip.id, trips)
  const parent = path.at(-1)
  // the title switches between trips of one family: the top trip and every side trip under it
  const family = descendants(path[0]?.id ?? trip.id, trips).length > 1
  const flagsOf = useTripFlags(trips, stops)
  const countries = flagsOf(trip)
  // the countries as a route over the title, like a departures board: where it's based first, then the rest
  // in the order you reach them (by the first day planned there)
  const route = routeOrder(countries, trip, trips, stops)
  const n = nights(trip.start_date, trip.end_date)
  const when = [fmtRange(trip.start_date, trip.end_date), n ? `${n} ${n === 1 ? 'night' : 'nights'}` : ''].filter(Boolean).join(' · ')
  const up = parent
  const upName = up ? up.name : 'all trips'

  return (
    <header className="trip-header">
      <OfflineBadge />
      <div className="trip-top">
        <Link to={up ? `/trip/${up.id}` : '/'} className="back-link" aria-label={`back to ${upName}`}>
          <Icon name="back" />{up && <CountryFlag code={flagsOf(up)[0]} />}<span>{upName}</span>
        </Link>
        {/* the people sharing the trip are also the way into its settings */}
        <button type="button" className="avatars trip-people" aria-label="edit trip" title={`shared with ${members.map(m => m.name || m.email).join(', ')}`} disabled={!canEdit} onClick={onEdit}>
          {members.map((m) => <span key={m.email} className="avatar" style={{ background: colourVar(m.color) }}>{(m.name || m.email).slice(0, 1)}</span>)}
        </button>
      </div>
      {route.length > 0 && (
        <p className="trip-route" aria-label={`countries: ${route.map(countryName).join(', ')}`}>
          {route.slice(0, ROUTE_MAX).map((c, i) => <span key={c}>{i > 0 && <i aria-hidden="true">→</i>}<abbr title={countryName(c)}>{c}</abbr></span>)}
          {route.length > ROUTE_MAX && <span className="trip-route-more">+{route.length - ROUTE_MAX}</span>}
        </p>
      )}
      <div className="trip-title-row">
        <h1 className="head one-line">
          {family ? (
            <button type="button" className="title-btn" aria-haspopup="dialog" onClick={() => setTree(true)}>
              <span>{trip.name}</span><Icon name="chevron" size={22} />
            </button>
          ) : <span>{trip.name}</span>}
        </h1>
        {add}
      </div>
      {when && <p className="trip-meta muted num"><span>{when}</span></p>}
      <TripNow trip={trip} country={countries[0]} stops={stops} />
      <Sheet open={tree} title="trips" onClose={() => setTree(false)}>
        <TripTree trips={trips} current={trip.id} flagsOf={flagsOf} onPick={() => setTree(false)} />
        <button type="button" className="btn ghost" disabled={!canEdit} onClick={() => { setTree(false); setAdding(true) }}><Icon name="plus" />add side trip</button>
      </Sheet>
      <Sheet page open={adding} title="new side trip" onClose={() => setAdding(false)}><TripForm parentId={trip.id} onDone={() => setAdding(false)} /></Sheet>
    </header>
  )
}
