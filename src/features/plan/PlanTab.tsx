import { memo, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Stop, Trip } from '../../lib/types'
import { useStops, useTrips } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { daysBetween, fmtDay, groupByDay, todayISO, tripDays } from '../../lib/dates'
import { agendaForDay, chosenDay, validDay } from '../../lib/agenda'
import { clashPairs, type Clash } from '../../lib/clash'
import { descendants } from '../../lib/countries'
import { loadState } from '../../lib/load'
import { LoadState } from '../../components/States'
import { Sheet } from '../../components/Sheet'
import { TripForm } from '../home/TripForm'
import { ClashRow } from '../trip/ClashRow'
import { FoldRow } from './FoldRow'
import { TripCalendar } from './TripCalendar'
import { DayCard } from './DayCard'
import { NoDate } from './NoDate'
import { useStopSheet } from '../stops/StopSheet'
import { useWide } from '../../lib/useWide'

// redraws only when its trip changes (or the link it reads), not when the page around it does
export const PlanTab = memo(function PlanTab({ trip }: { trip: Trip }) {
  const sheet = useStopSheet()
  const onOpen = sheet ? (s: Stop) => sheet.openStop(s.id) : undefined
  const tq = useTrips()
  const sq = useStops()
  const trips = tq.data ?? []
  const allStops = sq.data ?? []
  const load = loadState(tq, sq)
  const canEdit = useCanEdit()
  const wide = useWide()

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
  const selected = chosenDay(trip, trips, allStops, requested, todayISO())
  const datedKids = useMemo(() => children.filter((c) => c.start_date), [children])
  const undatedKids = useMemo(() => children.filter((c) => !c.start_date).sort((a, b) => a.name.localeCompare(b.name)), [children])

  const undated = groupByDay(trip, stops, children).undated
  const entries = selected ? agendaForDay(trip, trips, allStops, selected) : []
  if (load.state !== 'ready') return <LoadState load={load} blocks={2} />

  function adjust(c: Clash) {
    if (c.kind === 'stay') sheet?.editStop(c.b.id)
    else setAdjusting(trips.find((t) => t.id === c.b.id) ?? null)
  }

  function goDay(d: string) {
    if (!validDay(d) || !canOpen(d)) return
    setParams((p) => { const n = new URLSearchParams(p); n.set('day', d); n.delete('map'); return n })
  }

  const sub = [
    selected && trip.start_date && inTrip(selected) ? `day ${daysBetween(trip.start_date, selected) + 1} of ${all.length}` : '',
  ].filter(Boolean).join(' · ')

  return (
    <div className="plan">
      <LoadState load={load} />
      {mine.map((c) => <ClashRow key={`${c.a.id}-${c.b.id}`} clash={c} canEdit={canEdit} onAdjust={adjust} />)}
      {trip.notes?.trim() && (
        <details className="trip-notes">
          <summary>notes</summary>
          <p>{trip.notes}</p>
        </details>
      )}
      {selected && all.length > 0 && <TripCalendar trip={trip} children={datedKids} planned={plannedDays} selected={selected} onDay={goDay} fold={!wide} />}
      {selected ? <>
        <header className="day-title">
          <h2 className="head">{fmtDay(selected, { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '')}</h2>
          {sub && <p className="muted num">{sub}</p>}
        </header>
        <DayCard trip={trip} date={selected} entries={entries} colorIndex={trip.color} trips={trips} bare
          clash={clash} canEdit={canEdit} onOpen={onOpen} />
        {datedKids.filter(c => c.start_date! <= selected && (c.end_date ?? c.start_date!) >= selected).map(c =>
          <FoldRow key={c.id} trip={c} clash={clash.has(c.id)} />)}
      </> : <NoDate stops={undated} sideTrips={undatedKids} canEdit={canEdit} onOpen={onOpen} onSetDates={setAdjusting} />}
      <Sheet page open={!!adjusting} title="edit trip" onClose={() => setAdjusting(null)}>
        {adjusting && <TripForm key={adjusting.id} trip={adjusting} onDone={() => setAdjusting(null)} onDeleted={() => setAdjusting(null)} />}
      </Sheet>
    </div>
  )
})
