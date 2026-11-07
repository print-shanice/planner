import { lazy, Suspense, useEffect, useState } from 'react'
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
import { PHONE_TABS, WIDE_TABS, type Tab } from './tabs'
import { tint } from '../../components/MonthCalendar'
import { StopSheetProvider, useStopSheet } from '../stops/StopSheet'

type AddKind = 'stay' | 'journey' | 'side trip'

const MapTab = lazy(() => import('../map/MapTab').then((m) => ({ default: m.MapTab })))

function Panel({ tab, trip }: { tab: Tab; trip: Trip }) {
  switch (tab) {
    case 'map': return <Suspense fallback={null}><MapTab trip={trip} /></Suspense>
    case 'cost': return <MoneyTab trip={trip} />
    case 'ideas':
    case 'links': return <SavedTab key={`${trip.id}-${tab}`} trip={trip} view={tab} />
    case 'packing': return <PackingTab trip={trip} />
    default: return <PlanTab trip={trip} />
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

  const requestedTab = params.get('tab')
  const asked = (requestedTab === 'saved' ? 'ideas' : requestedTab === 'money' ? 'cost' : requestedTab as Tab) || (validDay(params.get('day')) ? 'itinerary' : 'plan')
  const tabs = wide ? WIDE_TABS : PHONE_TABS
  const tab: Tab = tabs.includes(asked) ? asked : 'plan'
  const day = params.get('day')
  return (
    <div className={`trip ${wide ? 'trip-wide' : 'trip-phone'} tab-is-${tab}`} style={tint(trip.color)}>
      <section className="trip-main">
        <TripHeader key={trip.id} trip={trip} />
        <div className="section-nav-row">
          <TripSummary sections={tabs}
            active={tab} onPick={(view) => {
              const next = new URLSearchParams(params)
              if (view === 'plan') { next.delete('tab'); next.delete('day') }
              else next.set('tab', view)
              setParams(next)
            }} />
        </div>
        {tab !== 'plan' && tab !== 'itinerary' && (
          <section id="trip-section" className="trip-inline-section" aria-label={tab}>
            {(tab === 'packing' || tab === 'map') && <header className="section-heading">
              <h2 className="head">{tab}</h2>
            </header>}
            <div className="section-content"><Panel key={`${trip.id}-${tab}`} tab={tab} trip={trip} /></div>
          </section>
        )}
        <div className="trip-panel" hidden={tab !== 'plan' && tab !== 'itinerary'}>
          <header className="itinerary-heading">
            <h2 className="head">{tab === 'itinerary' ? 'itinerary' : 'calendar'}</h2>
            <div className="itinerary-actions" aria-label="add to itinerary">
              {(['stay', 'journey', 'side trip'] as const).map((action) => (
                <button key={action} type="button" className="btn ghost" disabled={!canEdit} onClick={() => setKind(action)}>{action}</button>
              ))}
              <button type="button" className="btn ghost" disabled={!canEdit} onClick={() => stopSheet?.newStop('note', trip.id, { day: validDay(day) ? day : trip.start_date })}>add note</button>
            </div>
          </header>
          <PlanTab key={trip.id} trip={trip} view={tab === 'itinerary' || validDay(day) ? 'itinerary' : 'calendar'} />
        </div>
      </section>
      {wide && <aside className="trip-map"><Suspense fallback={null}><MapTab trip={trip} /></Suspense></aside>}
      <AddForms kind={kind} trip={trip} onClose={() => setKind(null)} />
    </div>
  )
}
