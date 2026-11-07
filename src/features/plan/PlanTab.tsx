import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { Place, Stop, Trip } from '../../lib/types'
import { useSave, useStops, useTrips } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { daysBetween, fmtDay, groupByDay, tripDays, type DayEntry } from '../../lib/dates'
import { planItems } from '../../lib/calendar'
import { clashPairs, type Clash } from '../../lib/clash'
import { descendants } from '../../lib/countries'
import { loadState } from '../../lib/load'
import { LoadState } from '../../components/States'
import { Sheet } from '../../components/Sheet'
import { TripForm } from '../home/TripForm'
import { ClashRow } from '../trip/ClashRow'
import { DayChips, itemId, jumpTo } from './DayChips'
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
  const inTrip = (d: string) => all.length > 0 && d >= all[0] && d <= all[all.length - 1]
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const selected = params.get('day')
  const datedKids = useMemo(() => children.filter((c) => c.start_date), [children])
  const undatedKids = useMemo(() => children.filter((c) => !c.start_date).sort((a, b) => a.name.localeCompare(b.name)), [children])

  const { items, undated } = useMemo(() => {
    const g = groupByDay(trip, stops, children)
    const have = new Set(g.days.map((d) => d.date))
    // a long trip only lists busy days; a day picked on the calendar joins them
    const wanted = selected && inTrip(selected) ? [...extra, selected] : extra
    const more = [...new Set(wanted)].filter((d) => !have.has(d)).map((date) => ({ date, entries: [] as DayEntry[] }))
    const days = [...g.days, ...more].sort((a, b) => a.date.localeCompare(b.date))
    return { items: planItems(days, children), undated: g.undated }
  }, [trip, stops, children, extra, selected]) // eslint-disable-line react-hooks/exhaustive-deps

  // scroll to the picked day once it's on screen (a folded day scrolls to its side trip)
  const scrolled = useRef<string | null>(null)
  useEffect(() => {
    if (!selected || scrolled.current === selected || load.state !== 'ready') return
    const item = items.find((i) => (i.kind === 'day' ? i.date === selected
      : i.trip.start_date! <= selected && (i.trip.end_date ?? i.trip.start_date!) >= selected))
    if (!item) return
    scrolled.current = selected
    requestAnimationFrame(() => jumpTo(itemId(item)))
  }, [selected, items, load.state])

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

  // a day inside a side trip is planned there, so it opens the side trip at that day
  function goDay(d: string) {
    const kid = datedKids.find((c) => c.start_date! <= d && (c.end_date ?? c.start_date!) >= d)
    if (kid) return navigate(`/trip/${kid.id}?day=${d}`)
    if (d === selected) {
      const item = items.find((i) => i.kind === 'day' && i.date === d)
      if (item) jumpTo(itemId(item))
      return
    }
    setExtra((x) => (x.includes(d) ? x : [...x, d]))
    setParams((p) => { const n = new URLSearchParams(p); n.set('day', d); return n }, { replace: true })
  }

  // month headings once the list spans more than one month
  const multi = items.length > 0 && items[0].date.slice(0, 7) !== items[items.length - 1].date.slice(0, 7)
  let shownMonth = ''

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
      {wantsCalendar(trip) && (
        <TripCalendar trip={trip} stops={stops} children={children} selected={selected} onDay={goDay} />
      )}
      <DayChips items={items} selected={selected} />
      {items.map((it) => {
        const m = it.date.slice(0, 7)
        const head = multi && m !== shownMonth
        shownMonth = m
        let body: JSX.Element
        if (it.kind === 'fold') body = <FoldRow trip={it.trip} clash={clash.has(it.trip.id)} />
        else {
          const idx = trip.start_date ? daysBetween(trip.start_date, it.date) : 0
          body = (
            <DayCard trip={trip} date={it.date} entries={it.entries} colorIndex={idx}
              dayNumber={inTrip(it.date) ? idx + 1 : null} clash={clash} canEdit={canEdit} onOpen={onOpen}
              onAddPlace={addPlace} />
          )
        }
        return (
          <Fragment key={itemId(it)}>
            {head && <h2 className="month-head head">{fmtDay(`${m}-01`, { month: 'long', year: 'numeric' })}</h2>}
            {body}
          </Fragment>
        )
      })}
      <NoDate trip={trip} stops={undated} sideTrips={undatedKids} canAdd={canEdit && all.length === 0} canEdit={canEdit}
        onOpen={onOpen} onAddPlace={(p) => addPlace(p, null)} onSetDates={setAdjusting} />
      <Sheet open={!!adjusting} title="edit trip" onClose={() => setAdjusting(null)}>
        {adjusting && <TripForm key={adjusting.id} trip={adjusting} onDone={() => setAdjusting(null)} onDeleted={() => setAdjusting(null)} />}
      </Sheet>
    </div>
  )
}
