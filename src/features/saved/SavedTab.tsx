import { useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import type { Link, Stop, Trip } from '../../lib/types'
import { useLinks, useSave, useStops, useTrips } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { dayLabel, tripDays } from '../../lib/dates'
import { loadState } from '../../lib/load'
import { categoryOf } from '../../lib/categories'
import { scheduleChange, unscheduled } from '../../lib/schedule'
import { normal } from '../../lib/itinerary'
import { descendants } from '../../lib/countries'
import { EmptyState } from '../../components/EmptyState'
import { LoadState } from '../../components/States'
import { Icon } from '../../components/Icon'
import { SaveFailed } from '../../components/SaveFailed'
import { Sheet } from '../../components/Sheet'
import { CountryFlag } from '../../components/CountryFlag'
import { useStopSheet } from '../stops/StopSheet'
import { TripForm } from '../home/TripForm'
import { Chip } from '../itinerary/ItinLine'
import { stopTitle } from '../plan/stopText'
import { LinkCard } from './LinkCard'
import { JotLine } from './JotLine'
import { Help, Tooltip } from '../../components/Tooltip'
import { Pending } from '../../components/Pending'
import { useLocating } from '../../lib/locating'

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
  const sub = [c === 'place' || c === 'note' ? '' : c, where, side, n ? `${n} ${n === 1 ? 'link' : 'links'}` : '']
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

// everything without a day: places and notes to fit in, and side trips still to date
export function SavedTab({ trip }: { trip: Trip }) {
  const tq = useTrips()
  const lq = useLinks()
  const sq = useStops()
  const canEdit = useCanEdit()
  const [dating, setDating] = useState<Trip | null>(null)
  const [query, setQuery] = useState('')
  const trips = tq.data ?? []
  const links = lq.data ?? []
  const stops = sq.data ?? []
  const load = loadState(tq, lq, sq)
  if (load.state !== 'ready' && !stops.length) return <LoadState load={load} />

  const q = normal(query.trim())
  const someday = trips.filter((t) => t.parent_id === trip.id && !t.start_date && has(q, t.name)).sort((a, b) => a.name.localeCompare(b.name))
  const ideas = unscheduled(trip, trips, stops).filter((s) => has(q, s.title, s.place?.name, s.place?.address, s.place?.city, s.place?.area, s.notes, s.category))
  const nothing = !someday.length && !ideas.length

  return (
    <div className="ideas">
      <LoadState load={load} />
      <label className="search-box ideas-search">
        <Icon name="search" size={18} />
        <input type="search" role="searchbox" aria-label="search ideas" placeholder="search ideas" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <JotLine trip={trip} />
      {nothing && <EmptyState title={q ? 'nothing found' : 'no ideas yet'} />}
      {someday.length > 0 && (
        <section aria-label="side trips without dates">
          <h3 className="mono-label">no dates yet</h3>
          <ul className="doc-list">
            {someday.map((t) => (
              <li key={t.id} className="doc-row">
                <RouterLink to={`/trip/${t.id}`} className="doc-row-main"><span className="doc-row-title"><CountryFlag code={t.base?.country} />{t.name}</span></RouterLink>
                <button type="button" className="text-select" disabled={!canEdit} onClick={() => setDating(t)}>set dates</button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {ideas.length > 0 && (
        <section aria-label="places">
          <h3 className="mono-label help-label">places &amp; notes · {ideas.length}<Help label="about adding ideas to the plan">choose “add to day” to move an idea into the plan; its notes, tickets and links stay attached</Help></h3>
          <ul className="doc-list" aria-label="ideas">{ideas.map((s) => <IdeaRow key={s.id} stop={s} trips={trips} links={links} />)}</ul>
        </section>
      )}
      <Sheet page open={!!dating} title="edit trip" onClose={() => setDating(null)}>
        {dating && <TripForm key={dating.id} trip={dating} onDone={() => setDating(null)} onDeleted={() => setDating(null)} />}
      </Sheet>
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
