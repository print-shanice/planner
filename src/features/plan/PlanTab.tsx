import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Place, Stop, Trip } from '../../lib/types'
import { useCosts, useRates, useSave, useStops, useTrips } from '../../lib/queries'
import { formatMoney, totals } from '../../lib/money'
import { useCanEdit } from '../../lib/offline'
import { daysBetween, fmtDay, groupByDay, todayISO, tripDays } from '../../lib/dates'
import { agendaForDay, validDay } from '../../lib/agenda'
import { clashPairs, type Clash } from '../../lib/clash'
import { descendants } from '../../lib/countries'
import { loadState } from '../../lib/load'
import { LoadState } from '../../components/States'
import { Sheet } from '../../components/Sheet'
import { TripForm } from '../home/TripForm'
import { ClashRow } from '../trip/ClashRow'
import { FoldRow } from './FoldRow'
import { TripCalendar } from './TripCalendar'
import { DayStrip } from './DayStrip'
import { DayCard } from './DayCard'
import { NoDate } from './NoDate'
import { useStopSheet } from '../stops/StopSheet'

export function PlanTab({ trip, view }: { trip: Trip; view?: 'calendar' | 'itinerary' }) {
  const sheet = useStopSheet()
  const onOpen = sheet ? (s: Stop) => sheet.openStop(s.id) : undefined
  const tq = useTrips()
  const sq = useStops()
  const trips = tq.data ?? []
  const allStops = sq.data ?? []
  const load = loadState(tq, sq)
  const canEdit = useCanEdit()
  const save = useSave('stops')
  const costs = useCosts().data ?? []
  const rates = useRates().data ?? null

  const stops = useMemo(() => allStops.filter((s) => s.trip_id === trip.id), [allStops, trip.id])
  const children = useMemo(() => trips.filter((t) => t.parent_id === trip.id), [trips, trip.id])
  const pairs = useMemo(() => clashPairs(trips, allStops), [trips, allStops])
  const clash = useMemo(() => new Set(pairs.flatMap((c) => [c.a.id, c.b.id])), [pairs])
  // a clash shows on every trip it touches, and on the trips above them
  const mine = useMemo(() => {
    const ids = new Set(descendants(trip.id, trips))
    return pairs.filter((c) => ids.has(c.a.tripId) || ids.has(c.b.tripId))
  }, [pairs, trips, trip.id])
  const [adjusting, setAdjusting] = useState<Trip | null>(null)
  const all = tripDays(trip)
  const inTrip = (d: string) => all.length > 0 && d >= all[0] && d <= all[all.length - 1]
  const [params, setParams] = useSearchParams()
  const requested = params.get('day')
  const family = new Set(descendants(trip.id, trips))
  const plannedDays = [...new Set(allStops.filter(s => family.has(s.trip_id) && s.day).map(s => s.day!))].sort()
  const canOpen = (d: string) => !all.length || inTrip(d) || plannedDays.includes(d)
  const fallbackDay = view === 'itinerary' ? (inTrip(todayISO()) ? todayISO() : all[0] ?? plannedDays[0] ?? null) : null
  const selected = view === 'calendar' ? null : validDay(requested) && canOpen(requested) ? requested : fallbackDay
  const datedKids = useMemo(() => children.filter((c) => c.start_date), [children])
  const undatedKids = useMemo(() => children.filter((c) => !c.start_date).sort((a, b) => a.name.localeCompare(b.name)), [children])

  const undated = groupByDay(trip, stops, children).undated
  const entries = selected ? agendaForDay(trip, trips, allStops, selected) : []
  if (load.state !== 'ready') return <LoadState load={load} blocks={2} />

  function adjust(c: Clash) {
    if (c.kind === 'stay') sheet?.editStop(c.b.id)
    else setAdjusting(trips.find((t) => t.id === c.b.id) ?? null)
  }

  function addPlace(p: Place, date: string | null) {
    const same = stops.filter((s) => (s.day ?? null) === date)
    const position = same.length ? Math.max(...same.map((s) => s.position)) + 1 : 0
    save.mutate({ trip_id: trip.id, kind: 'place', title: p.name, day: date, position, place: p, status: 'idea' })
  }

  function goDay(d: string) {
    if (!validDay(d) || !canOpen(d)) return
    setParams((p) => { const n = new URLSearchParams(p); n.set('day', d); if (view) n.set('tab', 'itinerary'); n.delete('map'); return n })
  }

  const days = [...new Set([...all, ...plannedDays])].sort()
  const dayCosts = selected ? costs.filter((c) => c.date === selected || (c.stop_id && entries.some((e) => e.kind === 'stop' && e.stop?.id === c.stop_id))) : []
  const spend = totals(dayCosts, trip.currency, rates)
  const sub = [
    selected && trip.start_date && inTrip(selected) ? `day ${daysBetween(trip.start_date, selected) + 1} of ${all.length}` : '',
    spend.paid + spend.planned > 0 ? formatMoney(spend.paid + spend.planned, trip.currency) : '',
  ].filter(Boolean).join(' · ')

  return (
    <div className="plan">
      <LoadState load={load} />
      {mine.map((c) => <ClashRow key={`${c.a.id}-${c.b.id}`} clash={c} canEdit={canEdit} onAdjust={adjust} />)}
      {selected ? <>
        <DayStrip days={days} selected={selected} onPick={goDay} />
        <header className="day-title">
          <h1 className="head">{fmtDay(selected, { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '')}</h1>
          {sub && <p className="muted num">{sub}</p>}
        </header>
        <DayCard trip={trip} date={selected} entries={entries} colorIndex={0} trips={trips} bare
          clash={clash} canEdit={canEdit} onOpen={onOpen} onAddPlace={addPlace} />
        {datedKids.filter(c => c.start_date! <= selected && (c.end_date ?? c.start_date!) >= selected).map(c =>
          <FoldRow key={c.id} trip={c} clash={clash.has(c.id)} />)}
      </> : <>
        {trip.notes?.trim() && (
          <details className="trip-notes">
            <summary>notes</summary>
            <p>{trip.notes}</p>
          </details>
        )}
        {all.length > 0
          ? <TripCalendar trip={trip} children={datedKids} planned={plannedDays} onDay={goDay} />
          : <NoDate trip={trip} stops={undated} sideTrips={undatedKids} canAdd={canEdit} canEdit={canEdit}
              onOpen={onOpen} onAddPlace={(p) => addPlace(p, null)} onSetDates={setAdjusting} />}
      </>}
      <Sheet open={!!adjusting} title="edit trip" onClose={() => setAdjusting(null)}>
        {adjusting && <TripForm key={adjusting.id} trip={adjusting} onDone={() => setAdjusting(null)} onDeleted={() => setAdjusting(null)} />}
      </Sheet>
    </div>
  )
}
