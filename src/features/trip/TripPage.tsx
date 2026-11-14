import { lazy, Suspense, useEffect, useRef, useState, useTransition } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useStops, useTrips } from '../../lib/queries'
import { chosenDay, ownerOn } from '../../lib/agenda'
import { dayLabel, todayISO } from '../../lib/dates'
import { rememberPlan } from '../../lib/resume'
import { useWide } from '../../lib/useWide'
import { loadState } from '../../lib/load'
import type { Trip } from '../../lib/types'
import { EmptyState } from '../../components/EmptyState'
import { LoadState } from '../../components/States'
import { Loading } from '../../components/Loading'
import { Sheet } from '../../components/Sheet'
import { TripForm } from '../home/TripForm'
import { ItineraryTab } from '../itinerary/ItineraryTab'
import { MoneyTab } from '../money/MoneyTab'
import { LinksTab } from '../saved/SavedTab'
import { PlacesTab } from '../places/PlacesTab'
import { NotesTab } from '../notes/NotesTab'
import { TripSummary } from './TripSummary'
import { TripFacts, TripHeader } from './TripHeader'
import { isPackingLink, packingHome, PHONE_TABS, readTab, WIDE_TABS, type Tab } from './tabs'
import { tint } from '../../components/MonthCalendar'
import { StopSheetProvider, useStopSheet } from '../stops/StopSheet'
import { AddSheet, type AddKind } from './AddSheet'
import { HighlightProvider } from './highlight'
import { DragProvider } from '../itinerary/drag'
import { useAutoLocate } from '../itinerary/useAutoLocate'
import { ReadingDayProvider, useReadingDay } from './readingDay'
import { OfflineBadge } from '../../components/OfflineBadge'
import { CostForm } from '../money/CostForm'
import { CaptureForm } from '../capture/CaptureForm'
import { Icon } from '../../components/Icon'
import { useCanEdit } from '../../lib/offline'
import { SplitHandle, useSplit } from './SplitHandle'
import type { CSSProperties } from 'react'

const MapTab = lazy(() => import('../map/MapTab').then(m => ({ default: m.MapTab })))
const MapWait = () => <div className="map-tab"><Loading label="loading map" /></div>

// each kind opens its own form once the add menu has closed, so sheets never stack.
// nothing gets a date it wasn't given: without a day, a new stay, journey, note or place waits as an idea
export function AddForms({ kind, trip, day, onClose }: { kind: AddKind | null; trip: Trip; day: string | null; onClose: () => void }) {
  const sheet = useStopSheet()
  useEffect(() => {
    if (kind === 'stay') sheet?.newStop('stay', trip.id, { day, end_date: null })
    else if (kind === 'journey' || kind === 'note' || kind === 'place') sheet?.newStop(kind, trip.id, { day })
    else return
    onClose()
  }, [kind]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <Sheet page open={kind === 'cost'} title="new cost" onClose={onClose}>
        <CostForm trip={trip} day={day} onDone={onClose} />
      </Sheet>
      <Sheet page open={kind === 'link'} title="save a link" onClose={onClose}>
        <CaptureForm initial={null} tripId={trip.id} onDone={onClose} />
      </Sheet>
      <Sheet page open={kind === 'side trip'} title="new side trip" onClose={onClose}>
        <TripForm parentId={trip.id} onDone={onClose} />
      </Sheet>
    </>
  )
}

// names without a spot are looked up while the trip is open
function AutoLocate({ trip }: { trip: Trip }) {
  useAutoLocate(trip)
  return null
}

export function TripPage() {
  const { id } = useParams()
  return <StopSheetProvider><HighlightProvider><ReadingDayProvider key={id}><TripScreen key={id} /></ReadingDayProvider></HighlightProvider></StopSheetProvider>
}

function TripScreen() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const tq = useTrips()
  const sq = useStops()
  const trips = tq.data ?? []
  const stops = sq.data ?? []
  const trip = trips.find(t => t.id === id)
  const load = loadState(tq, sq)
  const reading = useReadingDay()
  const wide = useWide()
  const canEdit = useCanEdit()
  const [kind, setKind] = useState<AddKind | null>(null)
  const [menu, setMenu] = useState(false)
  const [editing, setEditing] = useState(false)
  // a section can take a moment to build: the tab answers at once, and totoro fills the space until it's there
  const [switching, startSwitch] = useTransition()
  const main = useRef<HTMLElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const sentinel = useRef<HTMLSpanElement>(null)
  const [stuck, setStuck] = useState(false)
  const [planW, setPlanW] = useSplit()
  // toasts and panels outside the page line up with the plan's column too
  useEffect(() => {
    const root = document.documentElement
    if (wide && planW != null) root.style.setProperty('--plan-w', `${planW}px`); else root.style.removeProperty('--plan-w')
    return () => { root.style.removeProperty('--plan-w') }
  }, [wide, planW])
  // the plan's search button lives in the header, beside the +
  const [searchSlot, setSearchSlot] = useState<HTMLElement | null>(null)
  const scrolls = useRef<Partial<Record<Tab, number>>>({})
  const tab = readTab(params, wide)
  const selected = trip ? chosenDay(trip, trips, stops, params.get('day'), todayISO()) : null
  // the day being read in the plan; the + adds to it and the map shows it
  const onDay = tab === 'plan' ? reading.day ?? selected : null
  // ?open=<stop id> (from a favourite on home) opens that place's card, then leaves the address
  const sheet = useStopSheet()
  const opening = params.get('open')
  useEffect(() => {
    if (!opening || !sq.data) return
    if (stops.some((s) => s.id === opening)) sheet?.openStop(opening, params.get('day'))
    setParams((p) => { const n = new URLSearchParams(p); n.delete('open'); return n }, { replace: true })
  }, [opening, !!sq.data]) // eslint-disable-line react-hooks/exhaustive-deps
  // packing moved to home: an old link goes there, for this trip
  const toPacking = !!id && isPackingLink(params)
  useEffect(() => { if (toPacking) navigate(packingHome(id!), { replace: true }) }, [toPacking]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (trip && tab === 'plan' && tq.data && sq.data) rememberPlan({ tripId: trip.id, day: reading.day ?? selected })
  }, [trip?.id, tab, reading.day, selected, tq.data, sq.data])

  // the plan's day strip sits just under the sticky bar, whatever height the bar has
  useEffect(() => {
    const el = bar.current
    const page = el?.closest<HTMLElement>('.trip')
    if (!el || !page || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => page.style.setProperty('--trip-bar-h', `${el.offsetHeight}px`))
    ro.observe(el)
    return () => ro.disconnect()
  }, [wide, !!trip, tab]) // eslint-disable-line react-hooks/exhaustive-deps
  // once scrolled, the bar gets a hairline under it
  useEffect(() => {
    const el = sentinel.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting), { root: wide ? main.current : null })
    io.observe(el)
    return () => io.disconnect()
  }, [wide, !!trip, tab]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!trip) {
    if (load.state === 'loading') return <main className="trip-wait"><Loading /></main>
    return <main className="center-screen">{load.state === 'ready' ? <EmptyState title="trip not found" /> : <LoadState load={load} />}<Link to="/" className="btn ghost">all trips</Link></main>
  }
  const owner = ownerOn(trip, trips, onDay)
  const phoneMap = !wide && tab === 'map'

  function pick(next: Tab) {
    scrolls.current[tab] = wide ? main.current?.scrollTop ?? 0 : window.scrollY
    startSwitch(() => setParams(p => {
      const n = new URLSearchParams(p)
      n.delete('view'); n.delete('map'); n.delete('tool')
      if (next === 'plan') n.delete('tab'); else n.set('tab', next)
      // the day being read follows you to the map and back
      const day = reading.day ?? selected
      if (tab === 'plan' && day) n.set('day', day)
      return n
    }))
    const y = scrolls.current[next] ?? 0
    if (wide) main.current?.scrollTo?.(0, y); else window.scrollTo?.(0, y)
  }
  const back = new URLSearchParams()
  if (selected) back.set('day', selected)
  if (params.get('pin')) back.set('pin', params.get('pin')!)
  const plus = <button type="button" className="icon-btn plus-btn" aria-label="add" disabled={!canEdit} onClick={() => setMenu(true)}><Icon name="plus" /></button>
  const menuTitle = onDay ? `add to ${dayLabel(onDay)}` : 'add'

  return (
    <DragProvider trip={trip}>
    <AutoLocate trip={trip} />
    <div className={`trip ${wide ? 'trip-wide' : 'trip-phone'} tab-is-${tab}${switching ? ' switching' : ''}`} style={{ ...tint(trip.color), ...(wide && planW != null ? { '--plan-w': `${planW}px` } : null) } as CSSProperties}>
      <section className="trip-main" ref={main}>
        {phoneMap ? (
          <div className="map-float">
            <Link to={`/trip/${trip.id}${back.size ? `?${back}` : ''}`} className="chip-pill back-chip" aria-label={`back to ${trip.name}`}><Icon name="back" /><span>{trip.name}</span></Link>
            <OfflineBadge inline />
            {plus}
            <TripSummary bar={false} tabs={PHONE_TABS} active={tab} onPick={pick} />
          </div>
        ) : (
          <><span ref={sentinel} className="trip-bar-sentinel" aria-hidden="true" />
          <div ref={bar} className={`trip-bar${stuck ? ' stuck' : ''}`}>
            <TripHeader trip={trip} add={<span className="trip-actions">{tab === 'plan' && <span ref={setSearchSlot} className="search-slot" />}{plus}</span>} onEdit={() => setEditing(true)} />
            {/* the sections are text tabs at the top on phones and laptops alike, like home's */}
            <TripSummary bar={false} tabs={wide ? WIDE_TABS : PHONE_TABS} active={tab} onPick={pick} />
          </div></>
        )}
        {switching && <Loading className="section-wait" />}
        {tab === 'plan' && <ItineraryTab trip={trip} searchSlot={searchSlot} />}
        {phoneMap && <section className="map-section" aria-label="map"><Suspense fallback={<MapWait />}><MapTab trip={trip} phone /></Suspense></section>}
        {tab === 'places' && <section className="trip-section" aria-label="places"><PlacesTab trip={trip} /></section>}
        {tab === 'notes' && <section className="trip-section" aria-label="notes"><NotesTab trip={trip} /></section>}
        {tab === 'links' && <section className="trip-section" aria-label="links"><LinksTab trip={trip} /></section>}
        {tab === 'money' && <section className="trip-section" aria-label="money"><MoneyTab trip={trip} /></section>}
      </section>
      {wide && <SplitHandle width={planW} onChange={setPlanW} />}
      {wide && <aside className="trip-map" aria-label="map"><Suspense fallback={<MapWait />}><MapTab trip={trip} ideas={tab === 'places'} /></Suspense></aside>}
      <AddSheet open={menu} title={menuTitle} onClose={() => setMenu(false)} onPick={k => { setMenu(false); setKind(k) }} />
      <AddForms kind={kind} trip={owner} day={onDay} onClose={() => setKind(null)} />
      <Sheet page open={editing} title="edit trip" onClose={() => setEditing(false)}><TripFacts trip={trip} /><TripForm trip={trip} onDone={() => setEditing(false)} onDeleted={() => { setEditing(false); navigate(trip.parent_id ? `/trip/${trip.parent_id}` : '/') }} /></Sheet>
    </div>
    </DragProvider>
  )
}
