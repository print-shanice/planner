import { useMemo, useState } from 'react'
import type { Place, Stop, Trip } from '../../lib/types'
import { useSave, useStops, useTrips } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { daysBetween, groupByDay, tripDays, type DayEntry } from '../../lib/dates'
import { clashPairs, type Clash } from '../../lib/clash'
import { descendants } from '../../lib/countries'
import { loadState } from '../../lib/load'
import { LoadState } from '../../components/States'
import { Sheet } from '../../components/Sheet'
import { TripForm } from '../home/TripForm'
import { ClashRow } from '../trip/ClashRow'
import { DayChips } from './DayChips'
import { DayCard } from './DayCard'
import { NoDate } from './NoDate'
import { useStopSheet } from '../stops/StopSheet'

export function PlanTab({ trip }: { trip: Trip }) {
  const sheet = useStopSheet()
  const onOpen = sheet ? (s: Stop) => sheet.openStop(s.id) : undefined
  const tq = useTrips()
  const sq = useStops()
  const trips = tq.data ?? []
  const allStops = sq.data ?? []
  const load = loadState(tq, sq)
  const canEdit = useCanEdit()
  const save = useSave('stops')
  const [extra, setExtra] = useState<string[]>([])

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
  const long = all.length > 21

  const { days, undated } = useMemo(() => {
    const g = groupByDay(trip, stops, children)
    const have = new Set(g.days.map((d) => d.date))
    const more = extra.filter((d) => !have.has(d)).map((date) => ({ date, entries: [] as DayEntry[] }))
    return { days: [...g.days, ...more].sort((a, b) => a.date.localeCompare(b.date)), undated: g.undated }
  }, [trip, stops, children, extra])

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

  function pick(d: string) {
    setExtra((x) => (x.includes(d) ? x : [...x, d]))
    requestAnimationFrame(() => document.getElementById(`day-${d}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

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
      <DayChips days={days.map((d) => d.date)} pick={long ? { min: all[0], max: all[all.length - 1], onPick: pick } : undefined} />
      {days.map((d, i) => {
        const idx = trip.start_date ? daysBetween(trip.start_date, d.date) : i
        const inTrip = !!trip.start_date && !!trip.end_date && d.date >= trip.start_date && d.date <= trip.end_date
        return (
          <DayCard key={d.date} trip={trip} date={d.date} entries={d.entries} colorIndex={idx}
            dayNumber={inTrip ? idx + 1 : null} clash={clash} canEdit={canEdit} onOpen={onOpen}
            onAddPlace={addPlace} />
        )
      })}
      <NoDate trip={trip} stops={undated} canAdd={canEdit && all.length === 0} onOpen={onOpen}
        onAddPlace={(p) => addPlace(p, null)} />
      <Sheet open={!!adjusting} title="edit trip" onClose={() => setAdjusting(null)}>
        {adjusting && <TripForm key={adjusting.id} trip={adjusting} onDone={() => setAdjusting(null)} onDeleted={() => setAdjusting(null)} />}
      </Sheet>
    </div>
  )
}
