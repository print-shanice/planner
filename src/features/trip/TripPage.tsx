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
import { TripSummary } from './TripSummary'
import { TripHeader } from './TripHeader'
import { PHONE_TABS, readTab, SAVED_VIEWS, WIDE_TABS, type SavedView, type Tab } from './tabs'
import { tint } from '../../components/MonthCalendar'
import { StopSheetProvider, useStopSheet } from '../stops/StopSheet'

type AddKind = 'stay' | 'journey' | 'side trip'

const MapTab = lazy(() => import('../map/MapTab').then((m) => ({ default: m.MapTab })))

function Panel({ tab, view, trip }: { tab: Tab; view: SavedView; trip: Trip }) {
  switch (tab) {
    case 'map': return <Suspense fallback={null}><MapTab trip={trip} /></Suspense>
    case 'money': return <MoneyTab trip={trip} />
    case 'saved': return view === 'packing' ? <PackingTab trip={trip} /> : <SavedTab key={`${trip.id}-${view}`} trip={trip} view={view} />
    default: return null
  }
}

export function AddForms({ kind, trip, onClose }: { kind: AddKind | null; trip: Trip; onClose: () => void }) {
  const sheet = useStopSheet()
  const [params] = useSearchParams()
  const requested = params.get('day')
  const day = validDay(requested) ? requested : trip.start_date
  useEffect(() => {
    if (kind === 'stay' || kind === 'journey') {
      const defaults = kind === 'stay' ? { day, end_date: trip.end_date }
        : { day }
      sheet?.newStop(kind, trip.id, defaults)
      onClose()
    }
  }, [kind]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <Sheet open={kind === 'side trip'} title="new side trip" onClose={onClose}>
        <TripForm parentId={trip.id} onDone={onClose} />
      </Sheet>
    </>
  )
}

export function TripPage() {
  return <StopSheetProvider><TripScreen /></StopSheetProvider>
}

function TripScreen() {
  const stopSheet = useStopSheet()
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const tq = useTrips()
  const trips = tq.data
  const load = loadState(tq)
  const wide = useWide()
  const canEdit = useCanEdit()
  const [kind, setKind] = useState<AddKind | null>(null)
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
        <TripHeader key={trip.id} trip={trip} />
        <TripSummary sections={tabs} active={tab} bar={!wide} onPick={(t) => pick(t)} />
        {tab !== 'plan' && (
          <section id="trip-section" className="trip-inline-section" aria-label={tab}>
            {tab === 'saved' && (
              <div className="segmented saved-switch" role="group" aria-label="saved">
                {SAVED_VIEWS.map((v) => <button key={v} type="button" aria-pressed={view === v} onClick={() => pick('saved', v)}>{v}</button>)}
              </div>
            )}
            <div className="section-content"><Panel key={`${trip.id}-${tab}`} tab={tab} view={view} trip={trip} /></div>
          </section>
        )}
        <div className="trip-panel" hidden={tab !== 'plan'}>
          <div className="itinerary-actions" aria-label="add to itinerary">
            {(['stay', 'journey', 'side trip'] as const).map((action) => (
              <button key={action} type="button" className="btn ghost" disabled={!canEdit} onClick={() => setKind(action)}>{action}</button>
            ))}
            <button type="button" className="btn ghost" disabled={!canEdit} onClick={() => stopSheet?.newStop('note', trip.id, { day: validDay(day) ? day : trip.start_date })}>add note</button>
          </div>
          <PlanTab key={trip.id} trip={trip} view={validDay(day) ? 'itinerary' : 'calendar'} />
        </div>
      </section>
      {wide && <aside className="trip-map"><Suspense fallback={null}><MapTab trip={trip} /></Suspense></aside>}
      <AddForms kind={kind} trip={trip} onClose={() => setKind(null)} />
    </div>
  )
}
