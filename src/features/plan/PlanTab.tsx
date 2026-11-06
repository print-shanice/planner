import { useMemo, useState } from 'react'
import type { Place, Stop, Trip } from '../../lib/types'
import { useSave, useStops, useTrips } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { daysBetween, groupByDay, tripDays, type DayEntry } from '../../lib/dates'
import { clashes } from '../../lib/clash'
import { loadState } from '../../lib/load'
import { LoadState } from '../../components/States'
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
  const clash = useMemo(() => clashes(trips, allStops), [trips, allStops])
  const all = tripDays(trip)
  const long = all.length > 21

  const { days, undated } = useMemo(() => {
    const g = groupByDay(trip, stops, children)
    const have = new Set(g.days.map((d) => d.date))
    const more = extra.filter((d) => !have.has(d)).map((date) => ({ date, entries: [] as DayEntry[] }))
    return { days: [...g.days, ...more].sort((a, b) => a.date.localeCompare(b.date)), undated: g.undated }
  }, [trip, stops, children, extra])

  if (load.state !== 'ready') return <LoadState load={load} blocks={2} />

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
    </div>
  )
}
