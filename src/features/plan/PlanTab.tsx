import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Place, Stop, Trip } from '../../lib/types'
import { useSave, useStops, useTrips } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { addDays, daysBetween, fmtDay, groupByDay, tripDays } from '../../lib/dates'
import { agendaForDay, validDay } from '../../lib/agenda'
import { CountryFlag } from '../../components/CountryFlag'
import { clashPairs, type Clash } from '../../lib/clash'
import { descendants } from '../../lib/countries'
import { loadState } from '../../lib/load'
import { LoadState } from '../../components/States'
import { Sheet } from '../../components/Sheet'
import { TripForm } from '../home/TripForm'
import { ClashRow } from '../trip/ClashRow'
import { FoldRow } from './FoldRow'
import { TripCalendar, wantsCalendar } from './TripCalendar'
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
  const [page, setPage] = useState(0)

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
  const selected = validDay(requested) && canOpen(requested) ? requested : null
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
    setParams((p) => { const n = new URLSearchParams(p); n.set('day', d); n.delete('map'); return n })
  }
  function overview() {
    setParams(p => { const n = new URLSearchParams(p); n.delete('day'); n.delete('map'); return n })
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
      <div className="agenda-toolbar">
        {selected ? <button type="button" className="btn ghost" onClick={overview}>trip overview</button> : <h2 className="head">the journey</h2>}
        <label className="agenda-date">jump to date<input aria-label="jump to date" type="date" value={selected ?? ''}
          min={trip.start_date ?? undefined} max={trip.end_date ?? undefined} onChange={e => goDay(e.target.value)} /></label>
      </div>
      {!selected && wantsCalendar(trip) && (
        <TripCalendar trip={trip} stops={stops} children={children} selected={selected} onDay={goDay} />
      )}
      {selected ? <>
        <nav className="agenda-week" aria-label="days">
          {Array.from({ length: 7 }, (_, i) => addDays(selected, i - 3)).filter(d => canOpen(d)).map(d => (
            <button type="button" key={d} aria-current={d === selected ? 'date' : undefined} onClick={() => goDay(d)}>
              <span>{fmtDay(d, { weekday: 'short' })}</span><strong>{+d.slice(8)}</strong><span>{fmtDay(d, { month: 'short' })}</span>
            </button>
          ))}
        </nav>
        <p className="muted agenda-scope"><CountryFlag code={trip.base?.country} /> {trip.name}{children.length > 0 ? ' · includes side trips' : ''}</p>
        <DayCard trip={trip} date={selected} entries={entries} colorIndex={0} trips={trips}
          dayNumber={trip.start_date && inTrip(selected) ? daysBetween(trip.start_date, selected) + 1 : null}
          clash={clash} canEdit={canEdit} onOpen={onOpen} onAddPlace={addPlace} />
        {datedKids.filter(c => c.start_date! <= selected && (c.end_date ?? c.start_date!) >= selected).map(c =>
          <FoldRow key={c.id} trip={c} clash={clash.has(c.id)} />)}
      </> : <>
        {[...datedKids].sort((a, b) => a.start_date!.localeCompare(b.start_date!)).map(c => <FoldRow key={c.id} trip={c} clash={clash.has(c.id)} />)}
        <h2 className="head agenda-heading">your days</h2>
        {plannedDays.slice(page * 7, page * 7 + 7).map(d => (
          <button type="button" className="agenda-summary" key={d} onClick={() => goDay(d)}>
            <span>{fmtDay(d, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
            <span className="muted">{agendaForDay(trip, trips, allStops, d).filter(e => e.kind === 'stop').length} plans · open day</span>
          </button>
        ))}
        {plannedDays.length > 7 && <nav className="agenda-toolbar" aria-label="planned days">
          <button type="button" className="btn ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>previous days</button>
          <span className="muted">{page + 1} / {Math.ceil(plannedDays.length / 7)}</span>
          <button type="button" className="btn ghost" disabled={(page + 1) * 7 >= plannedDays.length} onClick={() => setPage(p => p + 1)}>next days</button>
        </nav>}
      </>}
      <NoDate trip={trip} stops={undated} sideTrips={undatedKids} canAdd={canEdit && all.length === 0} canEdit={canEdit}
        onOpen={onOpen} onAddPlace={(p) => addPlace(p, null)} onSetDates={setAdjusting} />
      <Sheet open={!!adjusting} title="edit trip" onClose={() => setAdjusting(null)}>
        {adjusting && <TripForm key={adjusting.id} trip={adjusting} onDone={() => setAdjusting(null)} onDeleted={() => setAdjusting(null)} />}
      </Sheet>
    </div>
  )
}
