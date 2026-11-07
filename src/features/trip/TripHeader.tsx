import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Trip } from '../../lib/types'
import { ancestors, descendants } from '../../lib/countries'
import { fmtRange, nights } from '../../lib/dates'
import { useMembers, useTrips } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Sheet'
import { OfflineBadge } from '../../components/OfflineBadge'
import { TripForm } from '../home/TripForm'
import { TripTree } from './TripTree'
import { CountryFlag } from '../../components/CountryFlag'

// `inside` is a day or a section of this trip: the header shrinks to the way back to the trip
export function TripHeader({ trip, inside = false }: { trip: Trip; inside?: boolean }) {
  const trips = useTrips().data ?? []
  const members = useMembers().data ?? []
  const canEdit = useCanEdit()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [tree, setTree] = useState(false)
  const path = ancestors(trip.id, trips)
  const parent = path.at(-1)
  // the title switches between trips of one family: the top trip and every side trip under it
  const family = descendants(path[0]?.id ?? trip.id, trips).length > 1
  const n = nights(trip.start_date, trip.end_date)
  const when = [fmtRange(trip.start_date, trip.end_date), n ? `${n} ${n === 1 ? 'night' : 'nights'}` : ''].filter(Boolean).join(' · ')
  const up = inside ? trip : parent
  const upName = up ? up.name : 'all trips'

  return (
    <header className={`trip-header${inside ? ' inside' : ''}`}>
      <OfflineBadge />
      <Link to={up ? `/trip/${up.id}` : '/'} className="back-link" aria-label={`back to ${upName}`}>
        <Icon name="back" />{up && <CountryFlag code={up.base?.country} />}<span>{upName}</span>
      </Link>
      {!inside && <>
        {parent && <p className="side-of"><CountryFlag code={parent.base?.country} /><span>side trip of {parent.name}</span></p>}
        <div className="trip-title-row">
          <div className="stack-xs trip-title">
            <h1 className="head">
              {family ? (
                <button type="button" className="title-btn" aria-haspopup="dialog" onClick={() => setTree(true)}>
                  <CountryFlag code={trip.base?.country} />{trip.name}<Icon name="chevron" size={22} />
                </button>
              ) : <><CountryFlag code={trip.base?.country} />{trip.name}</>}
            </h1>
            {when && <p className="muted num">{when}</p>}
          </div>
          <div className="avatars" aria-label="members">
            {members.map((m) => <span key={m.email} className="avatar" title={m.name}>{(m.name || m.email).slice(0, 1)}</span>)}
          </div>
          <button type="button" className="icon-btn" aria-label="edit trip" disabled={!canEdit} onClick={() => setEditing(true)}>
            <Icon name="edit" />
          </button>
        </div>
      </>}
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
