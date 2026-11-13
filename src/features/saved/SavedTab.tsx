import { useMemo, useState } from 'react'
import type { Link, Stop, Trip } from '../../lib/types'
import { useLinks, useSave, useStops, useTrips } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { dayLabel, tripDays } from '../../lib/dates'
import { loadState } from '../../lib/load'
import { categoryOf } from '../../lib/categories'
import { scheduleChange } from '../../lib/schedule'
import { undatedPlaces } from '../../lib/notes'
import { normal } from '../../lib/itinerary'
import { descendants } from '../../lib/countries'
import { EmptyState } from '../../components/EmptyState'
import { LoadState } from '../../components/States'
import { Icon } from '../../components/Icon'
import { SaveFailed } from '../../components/SaveFailed'
import { useStopSheet } from '../stops/StopSheet'
import { Chip } from '../itinerary/ItinLine'
import { stopTitle } from '../plan/stopText'
import { LinkCard } from './LinkCard'
import { JotLine } from './JotLine'
import { Help, Tooltip } from '../../components/Tooltip'
import { Pending } from '../../components/Pending'
import { useLocating } from '../../lib/locating'
import { count } from '../../lib/words'

// put an idea on a day right from its row: the trip's days, or any date when the trip has none yet
export function DayPick({ stop, home, label = 'add to day' }: { stop: Stop; home: Trip; label?: string }) {
  const save = useSave('stops')
  const stops = useStops().data ?? []
  const canEdit = useCanEdit()
  const days = tripDays(home)
  const go = (d: string) => { if (d) save.mutate(scheduleChange(stop, d, stops)) }
  if (!canEdit) return null
  return days.length ? (
    <Tooltip text="move this into the plan; its notes, tickets and links stay attached"><select className="text-select" aria-label={`${label}: ${stopTitle(stop)}`} value="" onChange={(e) => go(e.target.value)}>
      <option value="">{label}</option>
      {days.map((d) => <option key={d} value={d}>{dayLabel(d)}</option>)}
    </select></Tooltip>
  ) : (
    <label className="text-select date-pick"><span>{label}</span><input type="date" aria-label={`${label}: ${stopTitle(stop)}`} value="" onChange={(e) => go(e.target.value)} /></label>
  )
}

function IdeaRow({ stop, trips, links }: { stop: Stop; trips: Trip[]; links: Link[] }) {
  const sheet = useStopSheet()
  // the trip's place finder is looking this one up in the background
  const looking = useLocating(stop.id)
  const home = trips.find((t) => t.id === stop.trip_id)
  const c = categoryOf(stop)
  const n = links.filter((l) => l.stop_id === stop.id).length
  const where = stop.place?.area || stop.place?.city || ''
  // the side trip it's for, unless that's just the city again
  const side = home && home.parent_id && home.name.toLowerCase() !== where.toLowerCase() ? home.name : ''
  const sub = [c === 'place' || c === 'note' ? '' : c, where, side, n ? count(n, 'link') : '']
    .filter(Boolean).join(' · ').toLowerCase()
  return (
    <li className="doc-row idea-row" data-stop={stop.id}>
      <Chip stop={stop} quiet />
      <button type="button" className="doc-row-main" onClick={() => sheet?.openStop(stop.id)}>
        <span className="doc-row-title">{stopTitle(stop)}</span>
        {looking ? <Pending label="finding the place" /> : sub && <span className="muted">{sub}</span>}
      </button>
      {home && <DayPick stop={stop} home={home} />}
      <SaveFailed table="stops" id={stop.id} />
    </li>
  )
}

const has = (q: string, ...xs: (string | null | undefined)[]) => !q || xs.some((x) => !!x && normal(x).includes(q))

// the places without a day yet, across the trip and its side trips, each ready to go onto a day
export function PlacesTab({ trip }: { trip: Trip }) {
  const tq = useTrips()
  const lq = useLinks()
  const sq = useStops()
  const [query, setQuery] = useState('')
  const trips = tq.data ?? []
  const links = lq.data ?? []
  const stops = sq.data ?? []
  const load = loadState(tq, lq, sq)
  if (load.state !== 'ready' && !stops.length) return <LoadState load={load} />

  const q = normal(query.trim())
  const places = undatedPlaces(trip, trips, stops).filter((s) => has(q, s.title, s.place?.name, s.place?.address, s.place?.city, s.place?.area, s.notes, s.category))

  return (
    <div className="ideas">
      <LoadState load={load} />
      <label className="search-box ideas-search">
        <Icon name="search" size={18} />
        <input type="search" role="searchbox" aria-label="search places" placeholder="search places" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <JotLine trip={trip} kind="place" />
      {!places.length ? <EmptyState title={q ? 'nothing found' : 'no places yet'} /> : (
        <section aria-label="not planned yet">
          <h3 className="mono-label help-label">not planned yet · {places.length}<Help label="about adding places to the plan">choose “add to day” to move a place into the plan; its notes, tickets and links stay attached</Help></h3>
          <ul className="doc-list" aria-label="places">{places.map((s) => <IdeaRow key={s.id} stop={s} trips={trips} links={links} />)}</ul>
        </section>
      )}
    </div>
  )
}

// the trip's saved links (reels, videos, pages), newest first, each maybe tied to a place
export function LinksTab({ trip }: { trip: Trip }) {
  const tq = useTrips()
  const lq = useLinks()
  const sq = useStops()
  const [query, setQuery] = useState('')
  const trips = tq.data ?? []
  const links = lq.data ?? []
  const stops = sq.data ?? []
  const load = loadState(tq, lq)
  const ids = useMemo(() => new Set(descendants(trip.id, trips)), [trip.id, trips])
  if (load.state !== 'ready' && !links.length) return <LoadState load={load} />
  const q = normal(query.trim())
  const shown = links.filter((l) => l.trip_id && ids.has(l.trip_id))
    .filter((l) => has(q, l.title, l.url, l.note, stops.find((s) => s.id === l.stop_id)?.title))
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
  return (
    <div className="ideas">
      <LoadState load={load} />
      <label className="search-box ideas-search">
        <Icon name="search" size={18} />
        <input type="search" role="searchbox" aria-label="search links" placeholder="search links" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {shown.length === 0 ? <EmptyState title={q ? 'nothing found' : 'no links yet'} /> : (
        <div className="link-list" aria-label="links">{shown.map((l) => <LinkCard key={l.id} link={l} trips={trips} />)}</div>
      )}
    </div>
  )
}
