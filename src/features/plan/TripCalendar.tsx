import { useMemo, useState } from 'react'
import type { Trip } from '../../lib/types'
import { shiftMonth, tripSpan, type Span } from '../../lib/calendar'
import { todayISO } from '../../lib/dates'
import { MonthCalendar } from '../../components/MonthCalendar'

type Props = { trip: Trip; children: Trip[]; planned: string[]; onDay: (d: string) => void }

// one whole month at a time: dots on days with plans, side trips as flagged bars that open them
export function TripCalendar({ trip, children, planned, onDay }: Props) {
  const today = todayISO()
  const has = useMemo(() => new Set(planned), [planned])
  // plans left outside changed trip dates stay reachable
  const start = [trip.start_date!, ...planned].sort()[0]
  const end = [trip.end_date ?? trip.start_date!, ...planned].sort().at(-1)!
  const inRange = (d: string) => (d >= trip.start_date! && d <= (trip.end_date ?? trip.start_date!)) || has.has(d)
  const [month, setMonth] = useState(() => (today >= start && today <= end ? today : start).slice(0, 7))
  const bars = useMemo(() => children.map(tripSpan).filter((x): x is Span => !!x), [children])

  return (
    <MonthCalendar month={month} today={today} ribbon={() => undefined} bars={bars} linkBars
      onPrev={month > start.slice(0, 7) ? () => setMonth(shiftMonth(month, -1)) : undefined}
      onNext={month < end.slice(0, 7) ? () => setMonth(shiftMonth(month, 1)) : undefined}
      onDay={onDay} canPick={inRange} marked={(d) => has.has(d)} />
  )
}
