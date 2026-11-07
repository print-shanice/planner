import { useMemo, useState } from 'react'
import type { Stop, Trip } from '../../lib/types'
import { citySpans, shiftMonth, tripSpan, weekOf, type Span } from '../../lib/calendar'
import { addDays, todayISO, tripDays } from '../../lib/dates'
import { useWide } from '../../lib/useWide'
import { MonthCalendar } from '../../components/MonthCalendar'

// every trip with dates, side trips included, gets its calendar
export function wantsCalendar(trip: Trip): boolean {
  return tripDays(trip).length > 0
}

type Props = { trip: Trip; stops: Stop[]; children: Trip[]; selected: string | null; onDay: (d: string) => void }

export function TripCalendar({ trip, stops, children, selected, onDay }: Props) {
  const today = todayISO()
  const wide = useWide()
  const start = trip.start_date!
  const end = trip.end_date ?? start
  const inTrip = (d: string) => d >= start && d <= end
  const clamp = (d: string) => (d < start ? start : d > end ? end : d)
  // the day the calendar is looking at: its month, or its week when folded
  const [anchor, setAnchor] = useState(() => (selected && inTrip(selected) ? selected : inTrip(today) ? today : start))
  // phones start folded to one week so the plan stays in view
  const [open, setOpen] = useState(false)
  const folded = !wide && !open

  const own = useMemo(() => tripSpan(trip)!, [trip])
  const bars = useMemo(() => [
    ...children.map(tripSpan).filter((x): x is Span => !!x),
    ...citySpans(trip, stops, children),
  ], [trip, stops, children])

  const month = anchor.slice(0, 7)
  const week = weekOf(anchor)
  const prev = folded
    ? week[0] > start ? () => setAnchor(clamp(addDays(anchor, -7))) : undefined
    : month > start.slice(0, 7) ? () => setAnchor(clamp(`${shiftMonth(month, -1)}-01`)) : undefined
  const next = folded
    ? week[6] < end ? () => setAnchor(clamp(addDays(anchor, 7))) : undefined
    : month < end.slice(0, 7) ? () => setAnchor(clamp(`${shiftMonth(month, 1)}-01`)) : undefined

  return (
    <MonthCalendar month={month} week={folded ? week : undefined} onPrev={prev} onNext={next}
      fold={wide ? undefined : { open, onToggle: () => setOpen((o) => !o) }}
      today={today} ribbon={(d) => (inTrip(d) ? own : undefined)} bars={bars} selected={selected}
      onDay={(d) => { setAnchor(d); onDay(d) }} canPick={inTrip} />
  )
}
