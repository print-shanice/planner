import { lazy, Suspense, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLinks, useStops, useTrips } from '../../lib/queries'
import { countryStatus, homeTotals, tripsInCountry } from '../../lib/countries'
import { countdown, todayISO } from '../../lib/dates'
import { useCanEdit } from '../../lib/offline'
import type { Trip } from '../../lib/types'
import { Sheet } from '../../components/Sheet'
import { EmptyState } from '../../components/EmptyState'
import { Icon } from '../../components/Icon'
import { OfflineBadge } from '../../components/OfflineBadge'
import { Totals } from './Totals'
import { nextSideTrips, TripCard, TripRow } from './Upcoming'
import { TripForm } from './TripForm'
import { LinkCard } from '../saved/LinkCard'

// maplibre is large and needs webgl; load it after the page shows
const Globe = lazy(() => import('./Globe').then((m) => ({ default: m.Globe })))

const regionName = (code: string) => {
  try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code } catch { return code }
}

export function HomePage() {
  const trips = useTrips().data ?? []
  const stops = useStops().data ?? []
  const unsorted = (useLinks().data ?? []).filter((l) => !l.trip_id)
  const canEdit = useCanEdit()
  const navigate = useNavigate()
  const today = todayISO()
  const [adding, setAdding] = useState(false)
  const [country, setCountry] = useState<string | null>(null)

  const status = useMemo(() => countryStatus(trips, stops, today), [trips, stops, today])
  const totals = useMemo(() => homeTotals(trips, stops), [trips, stops])

  const top = trips.filter((t) => !t.parent_id)
  const byStart = (a: Trip, b: Trip) => (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999') || a.name.localeCompare(b.name)
  const upcoming = top.filter((t) => countdown(t, today).kind !== 'done').sort(byStart)
  const past = top.filter((t) => countdown(t, today).kind === 'done').sort((a, b) => byStart(b, a))
  const sideRows = upcoming[0] ? nextSideTrips(upcoming[0], trips, today) : []

  const choices = country ? tripsInCountry(country, trips, stops) : []

  function pickCountry(code: string) {
    const list = tripsInCountry(code, trips, stops)
    if (list.length === 1) navigate(`/trip/${list[0].id}`)
    else if (list.length > 1) setCountry(code)
  }

  return (
    <main className="home">
      <OfflineBadge />
      <h1 className="wordmark home-mark">planner</h1>
      <Suspense fallback={<div className="globe" />}>
        <Globe status={status} onCountry={pickCountry} />
      </Suspense>
      {trips.length > 0 && <Totals {...totals} />}

      <section className="home-section">
        <div className="section-head">
          <h2 className="head">upcoming</h2>
          <button type="button" className="icon-btn filled" aria-label="new trip" disabled={!canEdit} onClick={() => setAdding(true)}>
            <Icon name="plus" />
          </button>
        </div>
        {trips.length === 0 && <EmptyState title="no trips yet" />}
        {upcoming.map((t, i) => (
          <div key={t.id} className="stack-sm">
            <TripCard trip={t} trips={trips} today={today} />
            {i === 0 && sideRows.length > 0 && (
              <div className="rows">{sideRows.map((s) => <TripRow key={s.id} trip={s} testId="side-row" />)}</div>
            )}
          </div>
        ))}
      </section>

      {unsorted.length > 0 && (
        <section className="home-section">
          <div className="section-head"><h2 className="head">unsorted</h2></div>
          {unsorted.map((l) => <LinkCard key={l.id} link={l} trips={trips} />)}
        </section>
      )}

      {past.length > 0 && (
        <section className="home-section">
          <div className="section-head"><h2 className="head">past</h2></div>
          <div className="rows">{past.map((t) => <TripRow key={t.id} trip={t} />)}</div>
        </section>
      )}

      <Sheet open={adding} title="new trip" onClose={() => setAdding(false)}>
        <TripForm onDone={() => setAdding(false)} />
      </Sheet>
      <Sheet open={!!country} title={country ? regionName(country) : ''} onClose={() => setCountry(null)}>
        <div className="rows">{choices.map((t) => <TripRow key={t.id} trip={t} />)}</div>
      </Sheet>
    </main>
  )
}
