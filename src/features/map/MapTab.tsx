import { useNavigate, useSearchParams } from 'react-router-dom'
import { chosenDay, dayEntries, ownerOn, validDay } from '../../lib/agenda'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { Place, Trip } from '../../lib/types'
import { useStops, useTrips } from '../../lib/queries'
import { dayColor, dayLabel, fmtDay, todayISO } from '../../lib/dates'
import { reversePlace } from '../../lib/photon'
import { placeFromMap } from '../../lib/google/places'
import { dayLegs } from '../../lib/legs'
import { useWalks } from '../plan/useWalks'
import { useRefreshPlaces } from '../../lib/google/refresh'
import { loadState } from '../../lib/load'
import { LoadNotice } from '../../components/States'
import { AddPlaceField } from '../plan/AddPlaceField'
import { FindPanel } from './FindPanel'
import { newPlaceStop } from '../../lib/stops'
import { useDrag } from '../itinerary/drag'
import type { Hit } from '../plan/usePlaceSearch'
import { biasFor } from '../../lib/guess'
import { useCanEdit } from '../../lib/offline'
import { busyDays, EMPTY, mapFeatures, type Filter } from './features'
import { hasSideTrips, overviewFeatures } from './overview'
import { TripMap } from './TripMap'
import { hasPoint } from '../../lib/walk'
import { mapBed } from '../../lib/legs'
import { stopTitle } from '../plan/stopText'
import { PlaceCard } from './PlaceCard'
import { PlacesSheet, type PlaceItem } from './PlacesSheet'
import { useReadingDay } from '../trip/readingDay'
import { useHighlight } from '../trip/highlight'
import { Icon } from '../../components/Icon'
import { Tooltip } from '../../components/Tooltip'
import { count } from '../../lib/words'

type Card = { place: Place; stopId?: string; seq: number; looking?: boolean }

// the middle of what the map shows, for searching before the map has said where it's looking
function middleOf(d: ReturnType<typeof mapFeatures>): { lat: number; lng: number } | null {
  const pts = d.pins.features.map((f) => f.geometry.coordinates)
  if (!pts.length) return null
  return { lng: pts.reduce((a, p) => a + p[0], 0) / pts.length, lat: pts.reduce((a, p) => a + p[1], 0) / pts.length }
}

// on a phone the floating bar and chips cover the top, the places sheet and tab bar the bottom
const PHONE_INSET = { top: 200, bottom: 160 }
// the places sheet floats this far above the screen's bottom (over the tab bar)
const SHEET_LIFT = 68

// the places sheet's height, worked out from what it will list rather than measured after it draws,
// so a new view is fitted around its own sheet (the numbers are map.css's: handle, title, rows, padding)
function sheetHeight(items: PlaceItem[], open: boolean): number {
  const rows = open ? items.reduce((h, p) => h + (p.sub ? 57 : 52), 0) : 0
  // past 45% of the screen the sheet scrolls
  return Math.round(Math.min(26 + 34 + 8 + rows, window.innerHeight * 0.45))
}

// redraws only when its trip changes (or the link it reads), not when the page around it does
export const MapTab = memo(function MapTab({ trip, phone = false, ideas = false }: { trip: Trip; phone?: boolean; ideas?: boolean }) {
  const tq = useTrips()
  const sq = useStops()
  const trips = tq.data ?? []
  const stops = sq.data ?? []
  const load = loadState(tq, sq)
  useRefreshPlaces(stops)
  const [params, setParams] = useSearchParams()
  const canEditMap = useCanEdit()
  const drag = useDrag()
  // ?find=<line>: a line of the plan without a place, being looked up (from its pin+)
  const findId = params.get('find')
  const finding = findId && canEditMap ? stops.find((s) => s.id === findId && !hasPoint(s.place)) ?? null : null
  // a laptop carries things from the map into the plan beside it: a pin (its line), an idea, a search result
  const carry = !phone && canEditMap ? drag : null
  const grabPin = carry ? (id: string, e: { clientX: number; clientY: number }) => {
    const s = stops.find((x) => x.id === id)
    if (s) carry.begin({ kind: 'line', stop: s, label: stopTitle(s).toLowerCase() }, e)
  } : undefined
  const grabHit = carry ? (h: Hit, e: { clientX: number; clientY: number }, resolve: () => Promise<Place>) => {
    const stop = newPlaceStop(h.place ?? { name: h.name, lat: null, lng: null, category: h.category }, trip.id)
    carry.begin({ kind: 'new', stop, label: h.name.toLowerCase(), resolve: h.place ? undefined : resolve }, e)
  } : undefined
  function doneFinding() {
    setParams((p) => {
      const n = new URLSearchParams(p)
      n.delete('find')
      // a phone came here from the plan: it goes back there, on the same day
      if (phone) n.delete('tab')
      return n
    }, { replace: true })
  }
  // reading the itinerary, the map follows the day being read
  const reading = useReadingDay().day
  const selected = reading ?? params.get('day')
  // on a laptop the map has no chips of its own: it shows the plan's day, or the whole trip
  // a trip with side trips opens on the whole trip; null means no choice yet, so that default is read as the trips arrive
  const [choice, setChoice] = useState<boolean | null>(null)
  const sides = hasSideTrips(trip, trips)
  const whole = choice ?? sides
  const planDay = phone ? null : chosenDay(trip, trips, stops, selected, todayISO())
  // without side trips, any new plan day shows that day; with them, scrolling the itinerary leaves the whole trip alone
  useEffect(() => { if (!sides) setChoice(null) }, [planDay, sides])
  // a day picked in the calendar or day strip (the link's ?day= changing after mount) shows that day
  const linkDay = params.get('day')
  const seenDay = useRef(linkDay)
  useEffect(() => { if (seenDay.current !== linkDay) { seenDay.current = linkDay; setChoice(false) } }, [linkDay])
  const filter: Filter = phone
    ? (params.get('map') === 'saved' ? 'saved' : validDay(selected) ? selected : 'all')
    : ideas ? 'saved' : whole || !planDay ? 'all' : planDay
  const setFilter = (value: Filter) => setParams(p => { const n = new URLSearchParams(p); n.delete('map'); if (value === 'saved') n.set('map', 'saved'); else if (value === 'all') n.delete('day'); else n.set('day', value); return n })
  const [card, setCard] = useState<Card | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const lit = useHighlight()
  // where the map is looking, so a search finds places there (state, so the search box always has the latest)
  const [view, setView] = useState<{ lat: number; lng: number; zoom: number } | null>(null)
  const seq = useRef(0)
  // Consume each request so pressing the same itinerary number can focus it again.
  const pin = params.get('pin')
  useEffect(() => {
    if (!pin) return
    const s = stops.find((x) => x.id === pin)
    if (!s) return
    setChoice(false)
    setCard({ place: s.place ?? s.destination ?? s.origin ?? { name: s.title, lat: null, lng: null }, stopId: s.id, seq: ++seq.current })
    setParams((p) => { const n = new URLSearchParams(p); n.delete('pin'); return n }, { replace: true })
  }, [pin, stops, setParams])


  const navigate = useNavigate()
  // the whole trip with side trips is an overview: home and one pin per side trip
  const overviewNow = useMemo(() => filter === 'all' && sides ? overviewFeatures(trip, trips, stops) : null, [trip, trips, stops, filter, sides])
  // the same object while its content is the same, so a realtime change elsewhere doesn't rebuild the html pins
  const overviewKey = overviewNow ? JSON.stringify(overviewNow) : ''
  const overview = useMemo(() => overviewNow, [overviewKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const data = useMemo(() => overview ? { ...EMPTY, lines: overview.lines } : mapFeatures(trip, trips, stops, filter), [overview, trip, trips, stops, filter])
  const openTrip = (id: string) => navigate(phone ? `/trip/${id}?tab=map` : `/trip/${id}`)
  const days = useMemo(() => busyDays(trip, trips, stops), [trip, trips, stops])
  const stop = card?.stopId ? stops.find((s) => s.id === card.stopId) : undefined
  const isDay = filter !== 'all' && filter !== 'saved'
  // the shown day's walks, along the streets, in the colour of the trip that owns the day
  const legs = useMemo(() => isDay ? dayLegs(dayEntries(trip, trips, stops, filter)) : [], [isDay, trip, trips, stops, filter])
  const walk = useWalks(legs, isDay)
  const dayTint = isDay ? dayColor(ownerOn(trip, trips, filter).color) : ''
  const walkNow = legs.map((l) => ({ path: walk(l.a, l.b)?.path ?? [], color: dayTint }))
  // the same lines while nothing about them changed, so the map doesn't redraw them on every render
  const walkSig = walkNow.map((w) => `${w.color}:${w.path.length}:${w.path[0]?.lat ?? ''}`).join('|')
  const walks = useMemo(() => walkNow, [walkSig]) // eslint-disable-line react-hooks/exhaustive-deps
  const pinItems: PlaceItem[] = data.pins.features.map((f) => {
    const s = stops.find((x) => x.id === f.properties.id)
    return { id: f.properties.id, n: f.properties.number, color: f.properties.color, title: (s ? stopTitle(s) : '').toLowerCase(), sub: [s?.time, s?.place?.city].filter(Boolean).join(' · ') }
  })
  // getting around has no number, but a day's list still names it, in the day's order
  const journeyItems: PlaceItem[] = isDay ? [...new Set(data.ends.features.map((f) => f.properties.id))].flatMap((id) => {
    const s = stops.find((x) => x.id === id)
    const f = data.ends.features.find((x) => x.properties.id === id)!
    return s ? [{ id, n: null, color: f.properties.color, title: stopTitle(s).toLowerCase(), sub: s.time ?? '' }] : []
  }) : []
  const dayOrderIds = isDay ? dayEntries(trip, trips, stops, filter).map((e) => e.stop?.id) : []
  const lineItems = isDay
    ? [...pinItems, ...journeyItems].sort((a, b) => dayOrderIds.indexOf(a.id) - dayOrderIds.indexOf(b.id))
    : pinItems
  // a day's list starts where you sleep
  const bedStop = isDay ? mapBed(dayEntries(trip, trips, stops, filter)) : null
  const bedName = bedStop ? bedStop.title || bedStop.place?.name || '' : ''
  const bed = bedName ? bedStop : null
  // the whole trip lists every stay it draws, in order of check-in
  const stayItems: PlaceItem[] = filter === 'all'
    ? data.beds.features.flatMap((f) => {
      const s = stops.find((x) => x.id === f.properties.id)
      const nm = s ? s.title || s.place?.name || '' : ''
      return nm ? [{ id: f.properties.id, n: null, icon: 'bed' as const, color: dayColor(trip.color), title: `staying at ${nm}`.toLowerCase(), sub: s?.day ? dayLabel(s.day) : '' }] : []
    })
    : []
  const items: PlaceItem[] = overview
    ? overview.sides.map((s) => ({ id: s.id, n: null, color: s.color, title: s.name, sub: s.dates }))
    : bed
    ? [{ id: bed.id, n: null, icon: 'bed', color: dayColor(trip.color), title: `staying at ${bedName}`.toLowerCase(), sub: '' }, ...lineItems]
    : [...stayItems, ...lineItems]
  const places = count(pinItems.length, 'place')
  const listTitle = overview ? count(overview.sides.length, 'side trip') : filter === 'all' ? places : filter === 'saved' ? count(data.saved.features.length, 'idea') : `${fmtDay(filter, { weekday: 'long', day: 'numeric' }).replace(',', '')} · ${places}`
  // a tall places sheet covers more than the usual margin, so the fit clears it
  const sheetH = phone && !card ? sheetHeight(items, listOpen) : 0
  const inset = useMemo(() => ({ top: PHONE_INSET.top, bottom: Math.max(PHONE_INSET.bottom, sheetH ? sheetH + SHEET_LIFT : 0) }), [sheetH])

  function pick(id: string) {
    // on a laptop the plan is beside the map: bring the pin's stop into view
    if (!phone) {
      const row = document.querySelector<HTMLElement>(`.trip-main [data-line="${CSS.escape(id)}"], .trip-main [data-stop="${CSS.escape(id)}"]`)
      row?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
      row?.querySelector<HTMLElement>('.itin-main, .doc-row-main, input')?.focus({ preventScroll: true })
    }
    const s = stops.find((x) => x.id === id)
    if (s) setCard({ place: s.place ?? s.destination ?? s.origin ?? { name: s.title, lat: null, lng: null }, stopId: s.id, seq: ++seq.current })
  }

  async function poi(gid: string, p: { lng: number; lat: number }) {
    const mine = ++seq.current
    setCard({ place: { name: '', lat: p.lat, lng: p.lng }, seq: mine, looking: true })
    const found = await placeFromMap(gid, todayISO()).catch(() => null)
    if (seq.current === mine) setCard(found ? { place: found, seq: mine } : { place: { name: '', lat: p.lat, lng: p.lng }, seq: mine })
  }

  async function empty(p: { lng: number; lat: number }) {
    if (card) { setCard(null); return }
    const mine = ++seq.current
    setCard({ place: { name: '', lat: p.lat, lng: p.lng }, seq: mine, looking: true })
    const found = await reversePlace(p.lat, p.lng).catch(() => null)
    if (seq.current === mine) setCard(found ? { place: found, seq: mine } : { place: { name: '', lat: p.lat, lng: p.lng }, seq: mine })
  }

  return (
    <div className="map-tab">
      <TripMap data={data} highlight={lit.id} inset={phone ? inset : undefined} fitKey={`${trip.id}|${filter}`} overview={overview} onTrip={openTrip} fallback={trip.base} focus={card && !card.stopId ? card.place : null} onGrab={grabPin}
        onPick={pick} onEmpty={empty} onPoi={poi} onCenter={setView} walks={walks} selected={card?.stopId ?? null} selectionKey={card?.seq} />
      <div className="map-top">
        <div className="map-search">
          {finding
            ? <FindPanel key={finding.id} stop={finding} near={biasFor(trip, trips, stops, finding.day)} onDone={doneFinding} />
            : <AddPlaceField alwaysOpen label="search" near={view ?? middleOf(data) ?? (hasPoint(trip.base) ? { lat: trip.base.lat!, lng: trip.base.lng! } : null)} onPick={(p) => setCard({ place: p, seq: ++seq.current })} onGrab={grabHit} />}
        </div>
        {phone ? <label className="map-scope"><span>show</span><select aria-label="map scope" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">whole trip</option>
          {[...new Set([...days, ...(isDay ? [filter] : [])])].sort().map(d => <option key={d} value={d}>{dayLabel(d)}</option>)}
          <option value="saved">ideas</option>
        </select></label> : null}
        {load.state === 'loading' && <span className="chip-pill quiet" role="status" aria-label="loading">loading</span>}
        {(load.state === 'failed' || load.stale) && <LoadNotice onRetry={load.retry} />}
      </div>
      {!phone && !ideas && planDay && !card && (
        <Tooltip text={whole ? 'return to the selected day' : 'show the whole trip'}><button type="button" className="chip-pill whole-trip" aria-pressed={whole} onClick={() => setChoice(!whole)}>
          <Icon name="globe" size={16} /><span>whole trip</span>
        </button></Tooltip>
      )}
      {phone && !card && <PlacesSheet items={items} title={listTitle} open={listOpen} onToggle={() => setListOpen(!listOpen)} onPick={overview ? openTrip : pick} />}
      {card && (
        <div className="map-bottom">
          <PlaceCard key={card.seq} trip={trip} place={card.place} stop={stop} day={isDay ? filter : null} looking={card.looking} defaultDay={isDay ? filter : null}
            onClose={() => setCard(null)} onDone={() => setCard(null)} />
        </div>
      )}
    </div>
  )
})
