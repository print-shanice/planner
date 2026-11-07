import { useEffect, useMemo, useState } from 'react'
import type { Trip } from '../../lib/types'
import { shiftMonth, tripSpan, weekOf, type Span } from '../../lib/calendar'
import { addDays, todayISO } from '../../lib/dates'
import { MonthCalendar } from '../../components/MonthCalendar'

type Props = { trip: Trip; children: Trip[]; planned: string[]; selected: string; onDay: (d: string) => void; fold: boolean }

// the day picker: dots on days with plans, side trips as flagged squares that open them.
// phones fold it to the chosen week (‹ › by week, the chevron opens the month); laptops show the month
export function TripCalendar({ trip, children, planned, selected, onDay, fold }: Props) {
  const today = todayISO()
  const has = useMemo(() => new Set(planned), [planned])
  // plans left outside changed trip dates stay reachable
  const start = [trip.start_date!, ...planned].sort()[0]
  const end = [trip.end_date ?? trip.start_date!, ...planned].sort().at(-1)!
  const inRange = (d: string) => (d >= trip.start_date! && d <= (trip.end_date ?? trip.start_date!)) || has.has(d)
  const [open, setOpen] = useState(false)
  const [monday, setMonday] = useState(() => weekOf(selected)[0])
  const [month, setMonth] = useState(() => selected.slice(0, 7))
  useEffect(() => { setMonday(weekOf(selected)[0]); setMonth(selected.slice(0, 7)) }, [selected])
  const bars = useMemo(() => children.map(tripSpan).filter((x): x is Span => !!x), [children])

  const folded = fold && !open
  const week = weekOf(monday)
  // a week across two months is named by its thursday
  const shown = folded ? week[3].slice(0, 7) : month
  const move = folded
    ? { prev: week[0] > start ? () => setMonday(addDays(monday, -7)) : undefined, next: week[6] < end ? () => setMonday(addDays(monday, 7)) : undefined }
    : { prev: month > start.slice(0, 7) ? () => setMonth(shiftMonth(month, -1)) : undefined, next: month < end.slice(0, 7) ? () => setMonth(shiftMonth(month, 1)) : undefined }

  return (
    <MonthCalendar month={shown} week={folded ? week : undefined} today={today} ribbon={() => undefined} bars={bars} linkBars
      selected={selected} onPrev={move.prev} onNext={move.next}
      fold={fold ? { open, onToggle: () => { if (!open) setMonth(week[3].slice(0, 7)); else setMonday(weekOf(selected)[0]); setOpen(!open) } } : undefined}
      onDay={onDay} canPick={inRange} marked={(d) => has.has(d)} />
  )
}
