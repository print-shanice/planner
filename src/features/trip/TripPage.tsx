import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useTrips } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { useWide } from '../../lib/useWide'
import type { Trip } from '../../lib/types'
import { EmptyState } from '../../components/EmptyState'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Sheet'
import { TripForm } from '../home/TripForm'
import { PlanTab } from '../plan/PlanTab'
import { MoneyTab } from '../money/MoneyTab'
import { SavedTab } from '../saved/SavedTab'
import { PackingTab } from '../packing/PackingTab'
import { TripHeader } from './TripHeader'
import { PHONE_TABS, TripTabs, WIDE_TABS, type Tab } from './TripTabs'
import { AddMenu, type AddKind } from './AddMenu'
import { StopSheetProvider, useStopSheet } from '../stops/StopSheet'

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
  useEffect(() => {
    if (kind === 'stay' || kind === 'journey' || kind === 'note') {
      const defaults = kind === 'stay' ? { day: trip.start_date, end_date: trip.end_date }
        : kind === 'journey' ? { day: trip.start_date } : {}
      sheet?.newStop(kind, trip.id, defaults)
      onClose()
    }
  }, [kind]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Sheet open={kind === 'side trip'} title="new side trip" onClose={onClose}>
      <TripForm parentId={trip.id} onDone={onClose} />
    </Sheet>
  )
}

export function TripPage() {
  return <StopSheetProvider><TripScreen /></StopSheetProvider>
}

function TripScreen() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const { data: trips, isLoading } = useTrips()
  const wide = useWide()
  const canEdit = useCanEdit()
  const [menu, setMenu] = useState(false)
  const [kind, setKind] = useState<AddKind | null>(null)

  const trip = trips?.find((t) => t.id === id)
  if (!trip) {
    if (isLoading || !trips) return null
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
  const setTab = (t: Tab) => setParams(t === 'plan' ? {} : { tab: t }, { replace: true })

  const add = (
    <button type="button" className={wide ? 'icon-btn filled' : 'fab'} aria-label="add" disabled={!canEdit} onClick={() => setMenu(true)}>
      <Icon name="plus" size={wide ? 20 : 26} />
    </button>
  )

  return (
    <div className={`trip ${wide ? 'trip-wide' : 'trip-phone'} tab-is-${tab}`}>
      <section className="trip-main">
        <TripHeader trip={trip} />
        {wide && <div className="tabs-row"><TripTabs tabs={tabs} value={tab} onChange={setTab} variant="top" />{add}</div>}
        <div id="tab-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="trip-panel">
          <Panel tab={tab} trip={trip} />
        </div>
      </section>
      {wide && <aside className="trip-map"><Suspense fallback={null}><MapTab trip={trip} /></Suspense></aside>}
      {!wide && (
        <>
          {tab !== 'map' && add}
          <TripTabs tabs={tabs} value={tab} onChange={setTab} variant="bottom" />
        </>
      )}
      <AddMenu open={menu} onClose={() => setMenu(false)} onPick={(k) => { setMenu(false); setKind(k) }} />
      <AddForms kind={kind} trip={trip} onClose={() => setKind(null)} />
    </div>
  )
}
