import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { Stop, Trip } from '../../lib/types'
import { innermostDay, shiftMonth, tripSpan, type Span } from '../../lib/calendar'
import { chosenDay, dayEntries, validDay } from '../../lib/agenda'
import { overviewItems, type ItinDay, type SideRow } from '../../lib/itinerary'
import { fmtRange } from '../../lib/dates'
import { MonthCalendar, tint } from '../../components/MonthCalendar'
import { Link } from 'react-router-dom'
import { useTripFlags } from '../../lib/tripGuess'
import { TripMark } from '../../components/TripMark'

type Props = { trip: Trip; trips: Trip[]; stops: Stop[]; today: string; onDay: (d: string) => void; renderDay: (d: ItinDay) => ReactNode }

// a long trip with side trips, as a calendar: side trips colour their days and open on a tap,
// the trip's own days get a dot, and the day you pick shows underneath
export function ParentCalendar({ trip, trips, stops, today, onDay, renderDay }: Props) {
  const [params, setParams] = useSearchParams()
  const flagsOf = useTripFlags(trips, stops)
  const kids = useMemo(() => trips.filter((t) => t.parent_id === trip.id && t.start_date), [trips, trip.id])
  // the same calendar as home: each day wears its innermost trip's colour, and every stretch of it starts with that trip's flag
  const spans = useMemo(() => [trip, ...kids].map(tripSpan).filter((x): x is Span => !!x), [trip, kids])
  const owner = (d: string) => innermostDay(d, spans, (s) => (s.trip?.id === trip.id ? 0 : 1))
  const navigate = useNavigate()
  const inSide = (d: string) => kids.some((t) => t.start_date! <= d && (t.end_date ?? t.start_date!) >= d)
  // the trip's own plans (not its side trips'), as dots
  const own = useMemo(() => new Set(stops.filter((s) => s.trip_id === trip.id && s.day).map((s) => s.day!)), [stops, trip.id])
  const asked = params.get('day')
  const selected = chosenDay(trip, trips, stops, validDay(asked) ? asked : null, today)
  const start = [trip.start_date ?? selected ?? today, ...own].sort()[0]
  const end = [trip.end_date ?? trip.start_date ?? selected ?? today, ...own].sort().at(-1)!
  const [month, setMonth] = useState((selected ?? start).slice(0, 7))
  useEffect(() => { if (selected) setMonth(selected.slice(0, 7)) }, [selected])
  useEffect(() => { if (selected) onDay(selected) }, [selected]) // eslint-disable-line react-hooks/exhaustive-deps
  const inRange = (d: string) => (d >= start && d <= end) || own.has(d)

  // a side trip's day opens that side trip on it; the trip's own day shows underneath
  const pick = (d: string) => {
    const side = owner(d)?.trip
    if (side && side.id !== trip.id) navigate(`/trip/${side.id}?day=${d}`)
    else setParams((p) => { const n = new URLSearchParams(p); n.set('day', d); return n })
  }
  // the picked day as the plan reads it; inside a side trip only the trip's own lines (the train there)
  const day: ItinDay | null = selected ? {
    date: selected, owner: trip,
    entries: dayEntries(trip, trips, stops, selected).filter((e) => !inSide(selected) || (e.stop?.trip_id === trip.id && e.kind !== 'staying')),
  } : null
  const rows = useMemo(() => overviewItems(trip, trips, stops, today).filter((i): i is SideRow => i.kind === 'side' && i.date.slice(0, 7) <= month && i.end.slice(0, 7) >= month), [trip, trips, stops, today, month])

  return (
    <div className="parent-cal">
      <MonthCalendar month={month} today={today} ribbon={owner} bars={[]} flag={(sp) => (sp.trip ? flagsOf(sp.trip)[0] ?? null : null)} selected={selected}
        onPrev={month > start.slice(0, 7) ? () => setMonth(shiftMonth(month, -1)) : undefined}
        onNext={month < end.slice(0, 7) ? () => setMonth(shiftMonth(month, 1)) : undefined}
        onDay={pick} canPick={inRange} marked={(d) => own.has(d)} />
      {rows.length > 0 && (
        <ul className="side-list" aria-label="side trips this month">
          {rows.map((r) => (
            <li key={r.trip.id} style={tint(r.trip.color)}>
              <Link to={`/trip/${r.trip.id}${r.date <= today && r.end >= today ? `?day=${today}` : ''}`} className="side-line">
                {flagsOf(r.trip).length ? <TripMark codes={flagsOf(r.trip)} max={3} /> : <span className="side-row-bar" aria-hidden="true" />}
                <span className="side-line-name">{r.trip.name}</span>
                <span className="side-line-meta mono">{fmtRange(r.date, r.end)} · {r.nights}n{r.places ? ` · ${r.places} ${r.places === 1 ? 'place' : 'places'}` : ''}</span>
                {r.toBook > 0 && <span className="warn-text side-line-book">{r.toBook} to book</span>}
                <span aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {day && renderDay(day)}
    </div>
  )
}
