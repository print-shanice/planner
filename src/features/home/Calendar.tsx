import { useMemo, useState } from 'react'
import type { Trip } from '../../lib/types'
import { innermostDay, openingMonth, shiftMonth, tripSpan, type Span } from '../../lib/calendar'
import { MonthCalendar } from '../../components/MonthCalendar'

const spans = (ts: Trip[]) => ts.map(tripSpan).filter((x): x is Span => !!x)

// the month at a glance: each day wears its innermost trip's colour, so a side trip takes over its days from its parent.
// opens on this month while a trip is on, else the month the soonest one starts
export function Calendar({ trips, today }: { trips: Trip[]; today: string }) {
  const [month, setMonth] = useState(() => openingMonth(trips, today))
  // a first trip added while home is open gives the calendar a month
  const m = month ?? openingMonth(trips, today)
  const all = useMemo(() => spans(trips), [trips])
  const depth = useMemo(() => {
    const byId = new Map(trips.map((t) => [t.id, t]))
    const of = (t: Trip | undefined, n = 0): number => (t?.parent_id && n < 20 ? of(byId.get(t.parent_id), n + 1) : n)
    return (s: Span) => of(s.trip)
  }, [trips])
  if (!m) return null
  return (
    <div className="home-cal">
      <MonthCalendar month={m} onPrev={() => setMonth(shiftMonth(m, -1))} onNext={() => setMonth(shiftMonth(m, 1))}
        today={today} ribbon={(d) => innermostDay(d, all, depth)} bars={[]} />
    </div>
  )
}
