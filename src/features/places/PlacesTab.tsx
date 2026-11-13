import { useEffect, useState, type FormEvent } from 'react'
import type { Link, Place, Stop, Trip } from '../../lib/types'
import { useCosts, useLinks, useSave, useStops, useTrips } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { dayLabel, tripDays } from '../../lib/dates'
import { loadState } from '../../lib/load'
import { categoryOf } from '../../lib/categories'
import { nextPosition } from '../../lib/schedule'
import { normal } from '../../lib/itinerary'
import { ancestors, descendants } from '../../lib/countries'
import { ownerOn } from '../../lib/agenda'
import { beforeByTime } from '../../lib/move'
import { biasFor } from '../../lib/guess'
import { newId } from '../../lib/id'
import { newPlaceStop } from '../../lib/stops'
import { kindOf, kindsIn, sameAs, tripPlaces, type KindFilter } from '../../lib/places'
import { setShownPlaces } from '../../lib/shownPlaces'
import { useLocating } from '../../lib/locating'
import { count } from '../../lib/words'
import { EmptyState } from '../../components/EmptyState'
import { LoadState } from '../../components/States'
import { Icon } from '../../components/Icon'
import { SaveFailed } from '../../components/SaveFailed'
import { Pending } from '../../components/Pending'
import { useStopSheet } from '../stops/StopSheet'
import { Chip } from '../itinerary/ItinLine'
import { useMove } from '../itinerary/useMove'
import { flash } from '../itinerary/flash'
import { stopTitle } from '../plan/stopText'
import { SearchResults, usePlaceField } from '../plan/usePlaceSearch'

// when a place happens, from its row: a day of the trip (one inside a side trip joins that side trip), back to
// not planned, or, while not planned, another trip of the family. a trip without dates takes any date
function PlaceWhen({ stop, trip, trips }: { stop: Stop; trip: Trip; trips: Trip[] }) {
  const save = useSave('stops')
  const saveCost = useSave('costs')
  const stops = useStops().data ?? []
  const costs = useCosts().data ?? []
  const move = useMove(trip)
  const canEdit = useCanEdit()
  if (!canEdit) return null
  const days = tripDays(trip)
  const name = stopTitle(stop)
  const label = stop.day ? `day for ${name}` : `add to day: ${name}`
  const family = descendants(trip.id, trips).map((id) => trips.find((t) => t.id === id)!).filter(Boolean)
  const toDay = (d: string) => move(stop, d, beforeByTime(stop, d, { top: trip, trips, stops, costs }), { said: `added to ${dayLabel(d)}` })
  const unplan = () => save.mutate({ id: stop.id, day: null, saved: true, position: nextPosition(stops, stop.trip_id, null, stop.id) })
  const toTrip = (id: string) => {
    save.mutate({ id: stop.id, trip_id: id })
    for (const c of costs.filter((c) => c.stop_id === stop.id)) saveCost.mutate({ id: c.id, trip_id: id })
  }
  function pick(v: string) {
    if (v === 'none') unplan()
    else if (v.startsWith('day:')) toDay(v.slice(4))
    else if (v.startsWith('trip:')) toTrip(v.slice(5))
  }
  if (!days.length) return (
    <label className="text-select date-pick"><span>{stop.day ? dayLabel(stop.day) : 'add to day'}</span>
      <input type="date" aria-label={label} value={stop.day ?? ''} onChange={(e) => (e.target.value ? toDay(e.target.value) : unplan())} />
    </label>
  )
  const side = (d: string) => { const o = ownerOn(trip, trips, d); return o.id === trip.id ? '' : ` · ${o.name}` }
  const others = stop.day ? [] : family.filter((t) => t.id !== stop.trip_id)
  return (
    <select className="text-select" aria-label={label} value={stop.day ? `day:${stop.day}` : ''} onChange={(e) => pick(e.target.value)}>
      {!stop.day && <option value="">add to day</option>}
      <optgroup label="days">{days.map((d) => <option key={d} value={`day:${d}`}>{dayLabel(d)}{side(d)}</option>)}</optgroup>
      {stop.day && <option value="none">not planned</option>}
      {others.length > 0 && <optgroup label="trip">{others.map((t) => <option key={t.id} value={`trip:${t.id}`}>{t.name}</option>)}</optgroup>}
    </select>
  )
}

function PlaceRow({ stop, trip, trips, links }: { stop: Stop; trip: Trip; trips: Trip[]; links: Link[] }) {
  const sheet = useStopSheet()
  // the trip's place finder is looking this one up in the background
  const looking = useLocating(stop.id)
  const home = trips.find((t) => t.id === stop.trip_id)
  const c = categoryOf(stop)
  const n = links.filter((l) => l.stop_id === stop.id).length
  const where = stop.place?.area || stop.place?.city || ''
  // the side trip it's for, unless that's just the city again
  const side = home && home.id !== trip.id && home.name.toLowerCase() !== where.toLowerCase() ? home.name : ''
  const sub = [c === 'place' || c === 'note' ? '' : c, where, side, n ? count(n, 'link') : '']
    .filter(Boolean).join(' · ').toLowerCase()
  return (
    <li className="doc-row idea-row" data-stop={stop.id}>
      <Chip stop={stop} quiet={!stop.day} />
      <button type="button" className="doc-row-main" onClick={() => sheet?.openStop(stop.id, stop.day)}>
        <span className="doc-row-title">{stopTitle(stop)}</span>
        {looking ? <Pending label="finding the place" /> : sub && <span className="muted">{sub}</span>}
      </button>
      <PlaceWhen stop={stop} trip={trip} trips={trips} />
      <SaveFailed table="stops" id={stop.id} />
    </li>
  )
}

// adding a place: what's typed is searched (google when set up) and a picked result comes with its spot, so it's
// on the map at once. enter keeps the name as typed (the trip's place finder pins it later). never the same place twice
function AddPlace({ trip, trips, stops }: { trip: Trip; trips: Trip[]; stops: Stop[] }) {
  const save = useSave('stops')
  const canEdit = useCanEdit()
  const [already, setAlready] = useState<Stop | null>(null)
  const root = ancestors(trip.id, trips)[0] ?? trip
  const known = tripPlaces(root, trips, stops)
  const field = usePlaceField(biasFor(trip, trips, stops, null), (p) => add(p.name || field.q.trim(), p))
  if (!canEdit) return null

  function add(title: string, place: Place | null) {
    if (!title) return
    const dup = sameAs({ title, place }, known)
    if (dup) { setAlready(dup); flash(dup.id); return }
    const row = place ? newPlaceStop(place, trip.id) : { id: newId(), trip_id: trip.id, kind: 'place' as const, title, status: 'idea' as const }
    save.mutateAsync({ ...row, day: null, position: nextPosition(stops, trip.id, null), saved: true })
      .catch(() => { /* the row stays with "couldn't save" and a retry */ })
    flash(row.id)
    field.clear()
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    add(field.q.trim(), null)
  }

  return (
    <div className="add-place">
      <form className="jot" onSubmit={submit}>
        <input type="text" role="combobox" aria-label="add a place" aria-autocomplete="list" aria-expanded={!!field.results?.length}
          placeholder="add a place…" value={field.q} autoComplete="off" enterKeyHint="done"
          onChange={(e) => { setAlready(null); field.change(e.target.value) }} />
        <button type="submit" className="btn small line-go" aria-label="add place" disabled={!field.q.trim()}>add</button>
      </form>
      {already && (
        <p role="status" aria-label="already there" className="warn-line">
          {stopTitle(already).toLowerCase()} is already in places · {already.day ? dayLabel(already.day) : 'not planned yet'}
        </p>
      )}
      <SearchResults field={field} label="places found" quiet />
    </div>
  )
}

const has = (q: string, ...xs: (string | null | undefined)[]) => !q || xs.some((x) => !!x && normal(x).includes(q))

// every place of the trip and its side trips: added by search (with a pin on the map), filtered by kind,
// searched, and put on a day (or a side trip) from its row
export function PlacesTab({ trip }: { trip: Trip }) {
  const tq = useTrips()
  const lq = useLinks()
  const sq = useStops()
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<KindFilter | null>(null)
  const trips = tq.data ?? []
  const links = lq.data ?? []
  const stops = sq.data ?? []
  const load = loadState(tq, lq, sq)
  const q = normal(query.trim())
  const found = tripPlaces(trip, trips, stops).filter((s) => has(q, s.title, s.place?.name, s.place?.address, s.place?.city, s.place?.area, s.notes, s.category))
  const kinds = kindsIn(found)
  const on = kind && kinds.some(([k]) => k === kind) ? kind : null
  const shown = on ? found.filter((s) => kindOf(s) === on) : found
  const key = shown.map((s) => s.id).join()
  // the map beside shows what the list shows
  useEffect(() => { setShownPlaces(shown.map((s) => s.id)) }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => setShownPlaces(null), [])
  if (load.state !== 'ready' && !stops.length) return <LoadState load={load} />

  const later = shown.filter((s) => !s.day)
  const planned = shown.filter((s) => s.day)
  const row = (s: Stop) => <PlaceRow key={s.id} stop={s} trip={trip} trips={trips} links={links} />

  return (
    <div className="ideas places">
      <LoadState load={load} />
      <AddPlace trip={trip} trips={trips} stops={stops} />
      <label className="search-box ideas-search">
        <Icon name="search" size={18} />
        <input type="search" role="searchbox" aria-label="search places" placeholder="search places" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {kinds.length > 1 && (
        <div className="kind-filter" role="group" aria-label="kind">
          <button type="button" aria-pressed={!on} onClick={() => setKind(null)}>all</button>
          {kinds.map(([k, n]) => <button key={k} type="button" aria-pressed={on === k} onClick={() => setKind(on === k ? null : k)}>{k} · {n}</button>)}
        </div>
      )}
      {!shown.length && <EmptyState title={q || on ? 'nothing found' : 'no places yet'} />}
      {later.length > 0 && (<>
        <h3 className="mono-label">not planned yet · {later.length}</h3>
        <ul className="doc-list" aria-label="not planned yet">{later.map(row)}</ul>
      </>)}
      {planned.length > 0 && (<>
        <h3 className="mono-label">in the plan · {planned.length}</h3>
        <ul className="doc-list" aria-label="in the plan">{planned.map(row)}</ul>
      </>)}
    </div>
  )
}
