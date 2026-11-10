import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Trip } from '../../lib/types'
import { ancestors, countryName, descendants } from '../../lib/countries'
import { useTripFlags } from '../../lib/tripGuess'
import { fmtRange, nights } from '../../lib/dates'
import { useMembers, useStops, useTrips } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Sheet'
import { OfflineBadge } from '../../components/OfflineBadge'
import { TripForm } from '../home/TripForm'
import { TripTree } from './TripTree'
import { CountryFlag } from '../../components/CountryFlag'

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
  // the first country sits beside the title; a trip through several shows the others with its dates
  const others = countries.slice(1)
  const flags = others.length > 0 && (
    <span className="trip-flags">
      {others.slice(0, 4).map(code => <CountryFlag key={code} code={code} />)}
      {others.length > 4 && <span className="trip-flags-more" aria-label={others.slice(4).map(countryName).join(', ')}>+{others.length - 4}</span>}
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
          <Icon name="back" />{up && <CountryFlag code={flagsOf(up)[0]} />}<span>{upName}</span>
        </Link>
        {/* the people sharing the trip are also the way into its settings */}
        <button type="button" className="avatars trip-people" aria-label="edit trip" title={`shared with ${members.map(m => m.name || m.email).join(', ')}`} disabled={!canEdit} onClick={onEdit}>
          {members.map((m) => <span key={m.email} className="avatar" style={{ background: `var(--g${(m.color ?? 0) % 6})` }}>{(m.name || m.email).slice(0, 1)}</span>)}
        </button>
      </div>
      <div className="trip-title-row">
        {countries[0] && <span className="title-flag"><CountryFlag code={countries[0]} /></span>}
        <h1 className="head one-line">
          {family ? (
            <button type="button" className="title-btn" aria-haspopup="dialog" onClick={() => setTree(true)}>
              <span>{trip.name}</span><Icon name="chevron" size={22} />
            </button>
          ) : <span>{trip.name}</span>}
        </h1>
        {add}
      </div>
      {(flags || when) && <p className="trip-meta muted num">{flags}{flags && when && <span aria-hidden="true">·</span>}{when && <span>{when}</span>}</p>}
      <Sheet open={tree} title="trips" onClose={() => setTree(false)}>
        <TripTree trips={trips} current={trip.id} flagsOf={flagsOf} onPick={() => setTree(false)} />
        <button type="button" className="btn ghost" disabled={!canEdit} onClick={() => { setTree(false); setAdding(true) }}><Icon name="plus" />add side trip</button>
      </Sheet>
      <Sheet page open={adding} title="new side trip" onClose={() => setAdding(false)}><TripForm parentId={trip.id} onDone={() => setAdding(false)} /></Sheet>
    </header>
  )
}
