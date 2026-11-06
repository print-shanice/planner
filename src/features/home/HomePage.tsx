import { lazy, Suspense, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStops, useTrips } from '../../lib/queries'
import { countryName, countryStatus, globePins, homeTotals, tripsInCountry } from '../../lib/countries'
import { countdown, todayISO } from '../../lib/dates'
import { useCanEdit } from '../../lib/offline'
import { loadState } from '../../lib/load'
import type { Trip } from '../../lib/types'
import { Sheet } from '../../components/Sheet'
import { EmptyState } from '../../components/EmptyState'
import { LoadState } from '../../components/States'
import { Icon } from '../../components/Icon'
import { OfflineBadge } from '../../components/OfflineBadge'
import { Totals } from './Totals'
import { TripRow } from './Upcoming'
import { Calendar } from './Calendar'
import { TripForm } from './TripForm'
import { AccountButton } from './Account'

// maplibre is large and needs webgl; load it after the page shows
const Globe = lazy(() => import('./Globe').then((m) => ({ default: m.Globe })))

export function HomePage() {
  const tq = useTrips()
  const sq = useStops()
  const trips = tq.data ?? []
  const stops = sq.data ?? []
  const load = loadState(tq, sq)
  const canEdit = useCanEdit()
  const navigate = useNavigate()
  const today = todayISO()
  const [adding, setAdding] = useState(false)
  const [country, setCountry] = useState<string | null>(null)

  const status = useMemo(() => countryStatus(trips, stops, today), [trips, stops, today])
  const pins = useMemo(() => globePins(trips, stops, today), [trips, stops, today])
  const totals = useMemo(() => homeTotals(trips, stops), [trips, stops])

  const top = trips.filter((t) => !t.parent_id)
  const byStart = (a: Trip, b: Trip) => (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999') || a.name.localeCompare(b.name)
  const upcoming = top.filter((t) => countdown(t, today).kind !== 'done').sort(byStart)
  const past = top.filter((t) => countdown(t, today).kind === 'done').sort((a, b) => byStart(b, a))

  const choices = country ? tripsInCountry(country, trips, stops) : []

  function pickCountry(code: string) {
    const list = tripsInCountry(code, trips, stops)
    if (list.length === 1) navigate(`/trip/${list[0].id}`)
    else if (list.length > 1) setCountry(code)
  }

  return (
    <main className="home">
      <header className="home-top">
        <h1 className="wordmark home-mark">
          <img src={`${import.meta.env.BASE_URL}wordmark.svg`} alt="planner" width="1367" height="468" />
        </h1>
        <OfflineBadge inline />
        <AccountButton />
      </header>

      <section className="home-section home-next">
        <div className="section-head">
          <h2 className="head">next up</h2>
          <button type="button" className="icon-btn filled" aria-label="new trip" disabled={!canEdit} onClick={() => setAdding(true)}>
            <Icon name="plus" />
          </button>
        </div>
        <LoadState load={load} blocks={1} />
        {load.state === 'ready' && trips.length === 0 && <EmptyState title="no trips yet" />}
        {load.state === 'ready' && trips.length > 0 && upcoming.length === 0 && <EmptyState title="nothing coming up" />}
        {upcoming.length > 0 && <Calendar trips={trips} today={today} />}
      </section>

      <div className="home-world">
        <Suspense fallback={<div className="globe-wrap" />}>
          <Globe status={status} pins={pins} onCountry={pickCountry} />
        </Suspense>
        {trips.length > 0 && <Totals {...totals} />}
      </div>

      {/* only shows once a trip has ended */}
      {past.length > 0 && (
        <section className="home-section home-past">
          <div className="section-head"><h2 className="head">past trips</h2></div>
          <div className="rows">{past.map((t) => <TripRow key={t.id} trip={t} />)}</div>
        </section>
      )}

      <Sheet open={adding} title="new trip" onClose={() => setAdding(false)}>
        <TripForm onDone={() => setAdding(false)} />
      </Sheet>
      <Sheet open={!!country} title={country ? countryName(country) : ''} onClose={() => setCountry(null)}>
        <div className="rows">{choices.map((t) => <TripRow key={t.id} trip={t} />)}</div>
      </Sheet>
    </main>
  )
}
