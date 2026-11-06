import { useMemo, useState } from 'react'
import type { Stop, Trip } from '../../lib/types'
import { citySpans, tripSpan, type Span } from '../../lib/calendar'
import { todayISO, tripDays } from '../../lib/dates'
import { MonthCalendar } from '../../components/MonthCalendar'

// a long trip, or one with side trips, gets the calendar; a short one has just its days
export function wantsCalendar(trip: Trip, children: Trip[]): boolean {
  const n = tripDays(trip).length
  return n > 0 && (n > 7 || children.some((c) => c.start_date))
}

type Props = { trip: Trip; stops: Stop[]; children: Trip[]; selected: string | null; onDay: (d: string) => void }

export function TripCalendar({ trip, stops, children, selected, onDay }: Props) {
  const today = todayISO()
  const first = trip.start_date!.slice(0, 7)
  const last = (trip.end_date ?? trip.start_date!).slice(0, 7)
  const inTrip = (d: string) => d >= trip.start_date! && d <= (trip.end_date ?? trip.start_date!)
  const [month, setMonth] = useState(() => {
    if (selected && inTrip(selected)) return selected.slice(0, 7)
    return inTrip(today) ? today.slice(0, 7) : first
  })
  const own = useMemo(() => tripSpan(trip)!, [trip])
  const bars = useMemo(() => [
    ...children.map(tripSpan).filter((x): x is Span => !!x),
    ...citySpans(trip, stops, children),
  ], [trip, stops, children])

  return (
    <MonthCalendar month={month} onMonth={setMonth} min={first} max={last} today={today}
      ribbon={(d) => (inTrip(d) ? own : undefined)} bars={bars} selected={selected} onDay={onDay} canPick={inTrip} />
  )
}
