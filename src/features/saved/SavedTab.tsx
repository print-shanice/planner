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
import { TripForm } from '../home/TripForm'

function PlaceItem({ stop, trip, trips }: { stop: Stop; trip: Trip; trips: Trip[] }) {
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
      <Icon name="bookmark" size={18} />
      <span className="stack-xs saved-name">
        <span>{stop.title || stop.place?.name}</span>
        {stop.place?.address && <span className="muted">{stop.place.address}</span>}
      </span>
      {canEdit && (
        <ItemMenu title={stop.title || stop.place?.name || 'place'}>
          {(close) => (<>
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

export function SavedTab({ trip }: { trip: Trip }) {
  const tq = useTrips()
  const lq = useLinks()
  const sq = useStops()
  const canEdit = useCanEdit()
  const [dating, setDating] = useState<Trip | null>(null)
  const trips = tq.data ?? []
  const links = lq.data ?? []
  const stops = sq.data ?? []
  const load = loadState(tq, lq, sq)
  const ids = useMemo(() => new Set(descendants(trip.id, trips)), [trip.id, trips])
  if (load.state !== 'ready') return <LoadState load={load} blocks={2} />
  const mine = links.filter((l) => l.trip_id && ids.has(l.trip_id)).sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
  const places = stops.filter((s) => s.saved && ids.has(s.trip_id))
  // a dated trip keeps its undated plans and side trips here, off the calendar
  const dated = tripDays(trip).length > 0
  const loose = dated ? stops.filter((s) => s.trip_id === trip.id && !s.day && !s.saved) : []
  const someday = dated ? trips.filter((t) => t.parent_id === trip.id && !t.start_date).sort((a, b) => a.name.localeCompare(b.name)) : []

  if (!mine.length && !places.length && !loose.length && !someday.length) return <EmptyState title="nothing saved yet" />
  return (
    <div className="saved stack">
      <LoadState load={load} />
      {(loose.length > 0 || someday.length > 0) && (
        <section className="block" aria-label="no date">
          <h3 className="head">no date</h3>
          <ul className="list">
            {someday.map((t) => (
              <li key={t.id} className="saved-place">
                <RouterLink to={`/trip/${t.id}`} className="saved-name nodate-name"><CountryFlag code={t.base?.country} />{t.name}</RouterLink>
                <button type="button" className="btn ghost small" disabled={!canEdit} onClick={() => setDating(t)}>set dates</button>
              </li>
            ))}
            {loose.map((s) => <PlaceItem key={s.id} stop={s} trip={trip} trips={trips} />)}
          </ul>
        </section>
      )}
      {mine.map((l) => <LinkCard key={l.id} link={l} trips={trips} />)}
      {places.length > 0 && (
        <section className="block" aria-label="saved places">
          <h3 className="head">saved places</h3>
          <ul className="list">{places.map((s) => <PlaceItem key={s.id} stop={s} trip={trip} trips={trips} />)}</ul>
        </section>
      )}
      <Sheet open={!!dating} title="edit trip" onClose={() => setDating(null)}>
        {dating && <TripForm key={dating.id} trip={dating} onDone={() => setDating(null)} onDeleted={() => setDating(null)} />}
      </Sheet>
    </div>
  )
}
