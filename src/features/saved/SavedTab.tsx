import { useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import type { Stop, Trip } from '../../lib/types'
import { useLinks, useRemove, useSave, useStops, useTrips } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { descendants } from '../../lib/countries'
import { fmtDay, tripDays } from '../../lib/dates'
import { loadState } from '../../lib/load'
import { EmptyState } from '../../components/EmptyState'
import { LoadState } from '../../components/States'
import { Icon } from '../../components/Icon'
import { TwoTapDelete } from '../../components/TwoTapDelete'
import { LinkCard } from './LinkCard'
import { ItemMenu } from './ItemMenu'
import { SaveFailed } from '../../components/SaveFailed'
import { Sheet } from '../../components/Sheet'
import { CountryFlag } from '../../components/CountryFlag'
import { useStopSheet } from '../stops/StopSheet'
import { TripForm } from '../home/TripForm'

function PlaceItem({ stop, trip, trips, pick }: { stop: Stop; trip: Trip; trips: Trip[]; pick?: { on: boolean; onToggle: () => void } }) {
  const sheet = useStopSheet()
  const save = useSave('stops')
  const remove = useRemove('stops')
  const stops = useStops().data ?? []
  const canEdit = useCanEdit()
  const home = trips.find((t) => t.id === stop.trip_id) ?? trip
  const days = tripDays(home)
  const toDay = (d: string) => {
    const last = Math.max(-1, ...stops.filter((s) => s.trip_id === stop.trip_id && s.day === d).map((s) => s.position))
    save.mutate({ id: stop.id, day: d, position: last + 1, saved: false })
  }
  return (
    <li className="saved-place">
      {pick ? <input type="checkbox" className="pick" aria-label={stop.title || stop.place?.name || 'place'} checked={pick.on} onChange={pick.onToggle} />
        : <Icon name={stop.saved ? 'bookmark' : 'pin'} size={18} />}
      <span className="stack-xs saved-name">
        <span>{stop.title || stop.place?.name}</span>
        {stop.place?.address && <span className="muted">{stop.place.address}</span>}
      </span>
      {canEdit && !pick && (
        <ItemMenu title={stop.title || stop.place?.name || 'place'}>
          {(close) => (<>
            <button type="button" className="btn ghost" onClick={() => { close(); sheet?.editStop(stop.id) }}>edit idea</button>
            {days.length > 0 && (
              <label className="field">
                <span className="label">add to day</span>
                <select value="" onChange={(e) => { if (e.target.value) { toDay(e.target.value); close() } }}>
                  <option value="" disabled>choose a day</option>
                  {days.map((d) => <option key={d} value={d}>{fmtDay(d, { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '')}</option>)}
                </select>
              </label>
            )}
            <label className="field">
              <span className="label">move to trip</span>
              <select value={stop.trip_id} onChange={(e) => save.mutate({ id: stop.id, trip_id: e.target.value })}>
                {[...trips].sort((a, b) => a.name.localeCompare(b.name)).map((t) => <option key={t.id} value={t.id}>{t.name.toLowerCase()}</option>)}
              </select>
            </label>
            <div className="row"><TwoTapDelete label="remove" onConfirm={() => remove.mutate(stop.id)} /></div>
          </>)}
        </ItemMenu>
      )}
      <SaveFailed table="stops" id={stop.id} />
    </li>
  )
}

const has = (q: string, ...xs: (string | null | undefined)[]) => xs.some((x) => x?.toLowerCase().includes(q))

export function SavedTab({ trip, view }: { trip: Trip; view?: 'ideas' | 'links' }) {
  const tq = useTrips()
  const lq = useLinks()
  const sq = useStops()
  const canEdit = useCanEdit()
  const removeStop = useRemove('stops')
  const removeLink = useRemove('links')
  const [dating, setDating] = useState<Trip | null>(null)
  const [selected, setSide] = useState<'ideas' | 'links'>('ideas')
  const side = view ?? selected
  const [query, setQuery] = useState({ ideas: '', links: '' })
  const [picking, setPicking] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const trips = tq.data ?? []
  const links = lq.data ?? []
  const stops = sq.data ?? []
  const load = loadState(tq, lq, sq)
  const ids = useMemo(() => new Set(descendants(trip.id, trips)), [trip.id, trips])
  if (load.state !== 'ready') return <LoadState load={load} blocks={2} />

  const q = query[side].trim().toLowerCase()
  // a dated trip keeps its undated plans and side trips here, off the calendar
  const dated = tripDays(trip).length > 0
  const someday = (dated ? trips.filter((t) => t.parent_id === trip.id && !t.start_date) : [])
    .filter((t) => has(q, t.name)).sort((a, b) => a.name.localeCompare(b.name))
  const ideas = stops.filter((s) => ids.has(s.trip_id) && (s.saved || (dated && s.trip_id === trip.id && !s.day)))
    .filter((s) => has(q, s.title, s.place?.name, s.place?.address, s.notes))
  const mine = links.filter((l) => l.trip_id && ids.has(l.trip_id)).sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    .filter((l) => has(q, l.title, l.url, l.note))
  const shown = side === 'ideas' ? ideas.map((s) => s.id) : mine.map((l) => l.id)
  const count = shown.filter((id) => picked.has(id)).length

  const switchTo = (s: 'ideas' | 'links') => { setSide(s); setPicking(false); setPicked(new Set()) }
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const pick = (id: string) => (picking ? { on: picked.has(id), onToggle: () => toggle(id) } : undefined)
  function removePicked() {
    for (const id of shown.filter((x) => picked.has(x))) (side === 'ideas' ? removeStop : removeLink).mutate(id)
    setPicked(new Set()); setPicking(false)
  }

  return (
    <div className="saved stack">
      <LoadState load={load} />
      {!view && <div className="segmented saved-switch" role="group" aria-label="show">
        <button type="button" aria-pressed={side === 'ideas'} onClick={() => switchTo('ideas')}>ideas</button>
        <button type="button" aria-pressed={side === 'links'} onClick={() => switchTo('links')}>links</button>
      </div>}
      <div className="saved-tools">
        <label className="search-box">
          <Icon name="search" size={18} />
          <input type="search" role="searchbox" aria-label={`search ${side}`} placeholder={`search ${side}`} value={query[side]}
            onChange={(e) => setQuery((x) => ({ ...x, [side]: e.target.value }))} />
        </label>
        {canEdit && shown.length > 0 && (
          <button type="button" className="btn ghost small" onClick={() => { setPicking((v) => !v); setPicked(new Set()) }}>
            {picking ? 'done' : 'select'}
          </button>
        )}
      </div>
      {picking && (
        <div className="pick-bar">
          <button type="button" className="btn ghost small" onClick={() => setPicked(new Set(shown))}>select all</button>
          <span className="muted num">{count} selected</span>
          <TwoTapDelete label={`delete ${count}`} disabled={!count} onConfirm={removePicked} />
        </div>
      )}
      {side === 'ideas' ? (
        someday.length + ideas.length === 0 ? <EmptyState title={q ? 'nothing found' : 'no ideas yet'} /> : (
          <ul className="list" aria-label="ideas">
            {someday.map((t) => (
              <li key={t.id} className="saved-place">
                <RouterLink to={`/trip/${t.id}`} className="saved-name nodate-name"><CountryFlag code={t.base?.country} />{t.name}</RouterLink>
                <button type="button" className="btn ghost small" disabled={!canEdit} onClick={() => setDating(t)}>set dates</button>
              </li>
            ))}
            {ideas.map((s) => <PlaceItem key={s.id} stop={s} trip={trip} trips={trips} pick={pick(s.id)} />)}
          </ul>
        )
      ) : (
        mine.length === 0 ? <EmptyState title={q ? 'nothing found' : 'no links yet'} />
          : mine.map((l) => <LinkCard key={l.id} link={l} trips={trips} pick={pick(l.id)} />)
      )}
      <Sheet open={!!dating} title="edit trip" onClose={() => setDating(null)}>
        {dating && <TripForm key={dating.id} trip={dating} onDone={() => setDating(null)} onDeleted={() => setDating(null)} />}
      </Sheet>
    </div>
  )
}
