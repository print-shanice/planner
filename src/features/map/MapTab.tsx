import { useSearchParams } from 'react-router-dom'
import { validDay } from '../../lib/agenda'
import { useMemo, useRef, useState } from 'react'
import type { Place, Trip } from '../../lib/types'
import { useStops, useTrips } from '../../lib/queries'
import { dayColor, daysBetween, fmtDay } from '../../lib/dates'
import { reversePlace } from '../../lib/photon'
import { loadState } from '../../lib/load'
import { LoadNotice } from '../../components/States'
import { AddPlaceField } from '../plan/AddPlaceField'
import { busyDays, mapFeatures, type Filter } from './features'
import { TripMap } from './TripMap'
import { PlaceCard } from './PlaceCard'

type Card = { place: Place; stopId?: string; seq: number }

export function MapTab({ trip }: { trip: Trip }) {
  const tq = useTrips()
  const sq = useStops()
  const trips = tq.data ?? []
  const stops = sq.data ?? []
  const load = loadState(tq, sq)
  const [params, setParams] = useSearchParams()
  const selected = params.get('day')
  const filter: Filter = params.get('map') === 'saved' ? 'saved' : validDay(selected) ? selected : 'all'
  const setFilter = (value: Filter) => setParams(p => { const n = new URLSearchParams(p); n.delete('map'); if (value === 'saved') n.set('map', 'saved'); else if (value === 'all') n.delete('day'); else n.set('day', value); return n })
  const [card, setCard] = useState<Card | null>(null)
  const center = useRef<{ lat: number; lng: number } | null>(null)
  const seq = useRef(0)

  const data = useMemo(() => mapFeatures(trip, trips, stops, filter), [trip, trips, stops, filter])
  const days = useMemo(() => busyDays(trip, trips, stops), [trip, trips, stops])
  const stop = card?.stopId ? stops.find((s) => s.id === card.stopId) : undefined

  function pick(id: string) {
    const s = stops.find((x) => x.id === id)
    if (s) setCard({ place: s.place ?? s.destination ?? s.origin ?? { name: s.title, lat: null, lng: null }, stopId: s.id, seq: ++seq.current })
  }

  async function empty(p: { lng: number; lat: number }) {
    if (card) { setCard(null); return }
    const mine = ++seq.current
    setCard({ place: { name: '', lat: p.lat, lng: p.lng }, seq: mine })
    const found = await reversePlace(p.lat, p.lng)
    if (found && seq.current === mine) setCard({ place: found, seq: mine })
  }

  return (
    <div className="map-tab">
      <TripMap data={data} fitKey={`${trip.id}|${filter}`} fallback={trip.base} focus={card && !card.stopId ? card.place : null}
        onPick={pick} onEmpty={empty} onCenter={(c) => { center.current = c }} />
      <div className="map-top">
        <div className="map-search">
          <AddPlaceField alwaysOpen label="search" near={center.current} onPick={(p) => setCard({ place: p, seq: ++seq.current })} />
        </div>
        <div className="map-chips" role="group" aria-label="show">
          <button type="button" className="chip-pill" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>all days</button>
          {days.map((d) => (
            <button key={d} type="button" className="chip-pill" aria-pressed={filter === d} onClick={() => setFilter(d)}>
              <span className="dot" style={{ background: dayColor(trip.start_date ? daysBetween(trip.start_date, d) : 0) }} />
              {fmtDay(d, { weekday: 'short', day: 'numeric' }).replace(',', '')}
            </button>
          ))}
          <button type="button" className="chip-pill" aria-pressed={filter === 'saved'} onClick={() => setFilter('saved')}>saved</button>
        </div>
        {load.state === 'loading' && <span className="chip-pill quiet" role="status" aria-label="loading">loading</span>}
        {(load.state === 'failed' || load.stale) && <LoadNotice onRetry={load.retry} />}
      </div>
      {card && (
        <div className="map-bottom">
          <PlaceCard key={card.seq} trip={trip} place={card.place} stop={stop} defaultDay={filter !== 'all' && filter !== 'saved' ? filter : null}
            onClose={() => setCard(null)} onDone={() => setCard(null)} />
        </div>
      )}
    </div>
  )
}
