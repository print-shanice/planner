import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useTrips } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { validDay } from '../../lib/agenda'
import { useWide } from '../../lib/useWide'
import { loadState } from '../../lib/load'
import type { Trip } from '../../lib/types'
import { EmptyState } from '../../components/EmptyState'
import { LoadState, Skeleton } from '../../components/States'
import { Sheet } from '../../components/Sheet'
import { TripForm } from '../home/TripForm'
import { PlanTab } from '../plan/PlanTab'
import { MoneyTab } from '../money/MoneyTab'
import { SavedTab } from '../saved/SavedTab'
import { PackingTab } from '../packing/PackingTab'
import { TripSummary, type Section } from './TripSummary'
import { TripHeader } from './TripHeader'
import { PHONE_TABS, readTab, SAVED_VIEWS, WIDE_TABS, type SavedView, type Tab } from './tabs'
import { tint } from '../../components/MonthCalendar'
import { StopSheetProvider, useStopSheet } from '../stops/StopSheet'
import { AddSheet, type AddKind } from './AddSheet'
import { HighlightProvider } from './highlight'
import { OfflineBadge } from '../../components/OfflineBadge'
import { CostForm } from '../money/CostForm'
import { LinkForm } from '../saved/LinkForm'
import { Icon } from '../../components/Icon'
import { dayLabel } from '../../components/MonthCalendar'


const MapTab = lazy(() => import('../map/MapTab').then((m) => ({ default: m.MapTab })))

function Panel({ tab, view, trip }: { tab: Tab; view: SavedView; trip: Trip }) {
  switch (tab) {
    case 'map': return <Suspense fallback={null}><MapTab trip={trip} phone /></Suspense>
    case 'money': return <MoneyTab trip={trip} />
    case 'saved': return view === 'packing' ? <PackingTab trip={trip} /> : <SavedTab key={`${trip.id}-${view}`} trip={trip} view={view} />
    default: return null
  }
}

// each kind opens its own form once the add menu has closed, so sheets never stack
export function AddForms({ kind, trip, day, idea, onClose }: { kind: AddKind | null; trip: Trip; day: string | null; idea: boolean; onClose: () => void }) {
  const sheet = useStopSheet()
  const start = day ?? trip.start_date
  useEffect(() => {
    if (kind === 'stay') sheet?.newStop('stay', trip.id, { day: start, end_date: trip.end_date })
    else if (kind === 'journey' || kind === 'note') sheet?.newStop(kind, trip.id, { day: start })
    else if (kind === 'place') sheet?.newStop('place', trip.id, day ? { day } : { saved: idea, day: null })
    else return
    onClose()
  }, [kind]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <Sheet open={kind === 'cost'} title="new cost" onClose={onClose}>
        <CostForm trip={trip} day={day} onDone={onClose} />
      </Sheet>
      <Sheet open={kind === 'link'} title="new link" onClose={onClose}>
        <LinkForm tripId={trip.id} onDone={onClose} />
      </Sheet>
      <Sheet open={kind === 'side trip'} title="new side trip" onClose={onClose}>
        <TripForm parentId={trip.id} onDone={onClose} />
      </Sheet>
    </>
  )
}

export function TripPage() {
  return <StopSheetProvider><HighlightProvider><TripScreen /></HighlightProvider></StopSheetProvider>
}

function TripScreen() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const tq = useTrips()
  const trips = tq.data
  const load = loadState(tq)
  const wide = useWide()
  const canEdit = useCanEdit()
  const [kind, setKind] = useState<AddKind | null>(null)
  const [menu, setMenu] = useState(false)
  const main = useRef<HTMLElement>(null)
  const scrolls = useRef<Record<string, number>>({})
  const scroller = () => (wide ? main.current : null)
  const where = `${readTab(params, wide).tab}/${readTab(params, wide).view}`
  useLayoutEffect(() => {
    const y = scrolls.current[where]
    if (y == null) return
    const el = scroller()
    if (el) el.scrollTop = y
    else window.scrollTo(0, y)
  }, [where]) // eslint-disable-line react-hooks/exhaustive-deps

  const trip = trips?.find((t) => t.id === id)
  if (!trip) {
    if (load.state === 'loading') return <main className="trip-wait"><Skeleton blocks={3} /></main>
    if (load.state !== 'ready') {
      return (
        <main className="center-screen">
          <LoadState load={load} />
          <Link to="/" className="btn ghost">all trips</Link>
        </main>
      )
    }
    return (
      <main className="center-screen">
        <EmptyState title="trip not found" />
        <Link to="/" className="btn ghost">all trips</Link>
      </main>
    )
  }

  const { tab, view } = readTab(params, wide)
  const tabs = wide ? WIDE_TABS : PHONE_TABS
  const day = params.get('day')
  const onDay = validDay(day) ? day : null
  const phoneMap = !wide && tab === 'map'
  const plus = <button type="button" className="icon-btn filled" aria-label="add" disabled={!canEdit} onClick={() => setMenu(true)}><Icon name="plus" /></button>
  // the day stays when you switch sections; each section keeps its own scroll
  function pick(next: Tab, nextView: SavedView = view) {
    scrolls.current[`${tab}/${view}`] = scroller()?.scrollTop ?? window.scrollY
    setParams((p) => {
      const n = new URLSearchParams(p)
      n.delete('view'); n.delete('map')
      if (next === 'plan') n.delete('tab')
      else n.set('tab', next)
      if (next === 'saved') n.set('view', nextView)
      return n
    })
  }
  return (
    <div className={`trip ${wide ? 'trip-wide' : 'trip-phone'} tab-is-${tab}`} style={tint(trip.color)}>
      <section className="trip-main" ref={main}>
        {phoneMap ? (
          // the phone map fills the screen; only the way back and the + float over it
          <div className="map-float">
            <Link to={`/trip/${trip.id}${onDay ? `?day=${onDay}` : ''}`} className="chip-pill back-chip" aria-label={`back to ${trip.name}`}><Icon name="back" size={18} /><span>{trip.name}</span></Link>
            <span className="map-float-end"><OfflineBadge inline />{plus}</span>
          </div>
        ) : <TripHeader key={trip.id} trip={trip} action={plus} />}
        <TripSummary bar={!wide} onPick={(x) => pick(x.tab, x.view)}
          sections={wide
            ? tabs.flatMap((t): Section[] => t === 'saved' ? SAVED_VIEWS.map((v) => ({ label: v, tab: t, view: v })) : [{ label: t, tab: t }])
            : tabs.map((t) => ({ label: t, tab: t }))}
          active={wide && tab === 'saved' ? view : tab} />
        {tab !== 'plan' && (
          <section id="trip-section" className="trip-inline-section" aria-label={tab}>
            {tab === 'saved' && !wide && (
              <div className="segmented saved-switch" role="group" aria-label="saved">
                {SAVED_VIEWS.map((v) => <button key={v} type="button" aria-pressed={view === v} onClick={() => pick('saved', v)}>{v}</button>)}
              </div>
            )}
            <div className="section-content"><Panel key={`${trip.id}-${tab}`} tab={tab} view={view} trip={trip} /></div>
          </section>
        )}
        <div className="trip-panel" hidden={tab !== 'plan'}>
          <PlanTab key={trip.id} trip={trip} />
        </div>
      </section>
      {wide && <aside className="trip-map"><Suspense fallback={null}><MapTab trip={trip} /></Suspense></aside>}
      <AddSheet open={menu} title={tab === 'plan' && onDay ? `add to ${dayLabel(onDay)}` : 'add'} onClose={() => setMenu(false)}
        onPick={(k) => { setMenu(false); setKind(k) }} />
      <AddForms kind={kind} trip={trip} day={tab === 'plan' ? onDay : null} idea={tab === 'saved'} onClose={() => setKind(null)} />
    </div>
  )
}
