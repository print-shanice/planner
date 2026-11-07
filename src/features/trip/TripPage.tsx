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
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Sheet'
import { TripForm } from '../home/TripForm'
import { PlanTab } from '../plan/PlanTab'
import { MoneyTab } from '../money/MoneyTab'
import { SavedTab } from '../saved/SavedTab'
import { PackingTab } from '../packing/PackingTab'
import { TripHeader } from './TripHeader'
import { PHONE_TABS, WIDE_TABS, type Tab } from './tabs'
import { TripSummary } from './TripSummary'
import { tint } from '../../components/MonthCalendar'
import { AddMenu, type AddKind } from './AddMenu'
import { StopSheetProvider, useStopSheet } from '../stops/StopSheet'
import { CostForm } from '../money/CostForm'
import { LinkForm } from '../saved/LinkForm'

const MapTab = lazy(() => import('../map/MapTab').then((m) => ({ default: m.MapTab })))

function Panel({ tab, trip }: { tab: Tab; trip: Trip }) {
  switch (tab) {
    case 'map': return <Suspense fallback={null}><MapTab trip={trip} /></Suspense>
    case 'money': return <MoneyTab trip={trip} />
    case 'saved': return <SavedTab trip={trip} />
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
    if (kind === 'stay' || kind === 'journey' || kind === 'note') {
      const defaults = kind === 'stay' ? { day, end_date: trip.end_date }
        : kind === 'journey' ? { day } : { day }
      sheet?.newStop(kind, trip.id, defaults)
      onClose()
    }
  }, [kind]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <Sheet open={kind === 'side trip'} title="new side trip" onClose={onClose}>
        <TripForm parentId={trip.id} onDone={onClose} />
      </Sheet>
      <Sheet open={kind === 'cost'} title="new cost" onClose={onClose}>
        <CostForm trip={trip} onDone={onClose} />
      </Sheet>
      <Sheet open={kind === 'link'} title="new link" onClose={onClose}>
        <LinkForm tripId={trip.id} onDone={onClose} />
      </Sheet>
    </>
  )
}

export function TripPage() {
  return <StopSheetProvider><TripScreen /></StopSheetProvider>
}

function TripScreen() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const tq = useTrips()
  const trips = tq.data
  const load = loadState(tq)
  const wide = useWide()
  const canEdit = useCanEdit()
  const [menu, setMenu] = useState(false)
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

  const asked = (params.get('tab') as Tab) || 'plan'
  const tabs = wide ? WIDE_TABS : PHONE_TABS
  const tab: Tab = tabs.includes(asked) ? asked : 'plan'
  const day = params.get('day')
  const inside = tab !== 'plan' || validDay(day)

  const add = (
    <button type="button" className={wide ? 'icon-btn filled' : 'fab'} aria-label="add" disabled={!canEdit} onClick={() => setMenu(true)}>
      <Icon name="plus" size={wide ? 20 : 26} />
    </button>
  )

  return (
    <div className={`trip ${wide ? 'trip-wide' : 'trip-phone'} tab-is-${tab}`} style={tint(trip.color)}>
      <section className="trip-main">
        <TripHeader key={trip.id} trip={trip} inside={inside} />
        {!inside && <div className="tiles-row"><TripSummary trip={trip} sections={tabs.filter((t): t is Exclude<Tab, 'plan'> => t !== 'plan')} />{wide && add}</div>}
        {tab !== 'plan' && <h1 className="head section-title">{tab}</h1>}
        <div className="trip-panel">
          <Panel key={trip.id} tab={tab} trip={trip} />
        </div>
        {wide && inside && <div className="wide-add">{add}</div>}
      </section>
      {wide && <aside className="trip-map"><Suspense fallback={null}><MapTab trip={trip} /></Suspense></aside>}
      {!wide && tab !== 'map' && add}
      <AddMenu open={menu} onClose={() => setMenu(false)} onPick={(k) => { setMenu(false); setKind(k) }} />
      <AddForms kind={kind} trip={trip} onClose={() => setKind(null)} />
    </div>
  )
}
