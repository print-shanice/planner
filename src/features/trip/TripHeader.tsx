import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Trip } from '../../lib/types'
import { ancestors, countryName, descendants } from '../../lib/countries'
import { fmtRange, nights } from '../../lib/dates'
import { useMembers, useStops, useTrips } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Sheet'
import { OfflineBadge } from '../../components/OfflineBadge'
import { TripForm } from '../home/TripForm'
import { TripTree } from './TripTree'
import { CountryFlag } from '../../components/CountryFlag'

export function TripHeader({ trip, action }: { trip: Trip; action?: ReactNode }) {
  const trips = useTrips().data ?? []
  const stops = useStops().data ?? []
  const members = useMembers().data ?? []
  const canEdit = useCanEdit()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [tree, setTree] = useState(false)
  const path = ancestors(trip.id, trips)
  const parent = path.at(-1)
  // the title switches between trips of one family: the top trip and every side trip under it
  const family = descendants(path[0]?.id ?? trip.id, trips).length > 1
  const ids = new Set(descendants(trip.id, trips))
  const planned = stops.filter(s => ids.has(s.trip_id) && (!s.saved || s.day))
  const codes = (values: (string | null | undefined)[]) => [...new Set(values
    .map(code => code?.trim().toUpperCase()).filter((code): code is string => !!code && /^[A-Z]{2}$/.test(code)))]
  const destinations = codes([
    trip.base?.country,
    ...trips.filter(t => t.id !== trip.id && ids.has(t.id)).map(t => t.base?.country),
    ...planned.map(s => s.place?.country),
  ])
  // Journey endpoints are a fallback: an airport at home is not a holiday destination.
  const countries = destinations.length ? destinations : codes(planned.map(s => s.destination?.country))
  const flags = countries.length > 0 && (
    <span className="trip-flags" title={countries.map(countryName).join(', ')}>
      {countries.slice(0, 4).map(code => <CountryFlag key={code} code={code} />)}
      {countries.length > 4 && <span className="trip-flags-more" aria-label={countries.slice(4).map(countryName).join(', ')}>+{countries.length - 4}</span>}
    </span>
  )
  const n = nights(trip.start_date, trip.end_date)
  const when = [fmtRange(trip.start_date, trip.end_date), n ? `${n} ${n === 1 ? 'night' : 'nights'}` : ''].filter(Boolean).join(' · ')
  const up = parent
  const upName = up ? up.name : 'all trips'

  return (
    <header className="trip-header">
      <OfflineBadge />
      <div className="trip-top">
        <Link to={up ? `/trip/${up.id}` : '/'} className="back-link" aria-label={`back to ${upName}`}>
          <Icon name="back" />{up && <CountryFlag code={up.base?.country} />}<span>{upName}</span>
        </Link>
        <button type="button" className="avatars" aria-label="edit trip" disabled={!canEdit} onClick={() => setEditing(true)}>
          {members.map((m) => <span key={m.email} className="avatar" style={{ background: `var(--g${(m.color ?? 0) % 6})` }} title={m.name}>{(m.name || m.email).slice(0, 1)}</span>)}
        </button>
      </div>
      <div className="trip-title-row">
        <h1 className="head one-line">
          {family ? (
            <button type="button" className="title-btn" aria-haspopup="dialog" onClick={() => setTree(true)}>
              <span>{trip.name}</span><Icon name="chevron" size={22} />
            </button>
          ) : <span>{trip.name}</span>}
        </h1>
        {action}
      </div>
      {(flags || when) && <p className="trip-meta muted num">{flags}{flags && when && <span aria-hidden="true">·</span>}{when && <span>{when}</span>}</p>}
      <Sheet open={tree} title="trips" onClose={() => setTree(false)}>
        <TripTree trips={trips} current={trip.id} onPick={() => setTree(false)} />
      </Sheet>
      <Sheet open={editing} title="edit trip" onClose={() => setEditing(false)}>
        <TripForm trip={trip} onDone={() => setEditing(false)}
          onDeleted={() => { setEditing(false); navigate(trip.parent_id ? `/trip/${trip.parent_id}` : '/') }} />
      </Sheet>
    </header>
  )
}
