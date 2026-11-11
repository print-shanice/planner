import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Trip } from '../../lib/types'
import { innermostDay, openingMonth, shiftMonth, tripSpan, type Span } from '../../lib/calendar'
import { MonthCalendar } from '../../components/MonthCalendar'

const spans = (ts: Trip[]) => ts.map(tripSpan).filter((x): x is Span => !!x)

// the month at a glance: each day wears its innermost trip's colour, so a side trip takes over its days from its parent.
// opens on this month while a trip is on, else the month the soonest one starts. a day with a trip opens that day in it
const none = () => [] as string[]

export function Calendar({ trips, flagsOf = none, today, holiday, aside }: { trips: Trip[]; flagsOf?: (t: Trip) => string[]; today: string; holiday?: (d: string) => string | null; aside?: (month: string) => ReactNode }) {
  const [month, setMonth] = useState(() => openingMonth(trips, today))
  // a first trip added while home is open gives the calendar a month
  const m = month ?? openingMonth(trips, today)
  const all = useMemo(() => spans(trips), [trips])
  const depth = useMemo(() => {
    const byId = new Map(trips.map((t) => [t.id, t]))
    const of = (t: Trip | undefined, n = 0): number => (t?.parent_id && n < 20 ? of(byId.get(t.parent_id), n + 1) : n)
    return (s: Span) => of(s.trip)
  }, [trips])
  const navigate = useNavigate()
  const owner = (d: string) => innermostDay(d, all, depth)?.trip
  // every stretch of a trip's colour on the month starts with that trip's flag
  const flag = (s: Span) => (s.trip ? flagsOf(s.trip)[0] ?? null : null)
  if (!m) return null
  // the month on the left; beside it, whatever home shows for that month
  return (
    <div className="home-month">
      <div className="home-cal">
        <MonthCalendar month={m} onPrev={() => setMonth(shiftMonth(m, -1))} onNext={() => setMonth(shiftMonth(m, 1))}
          today={today} ribbon={(d) => innermostDay(d, all, depth)} bars={[]} flag={flag} holiday={holiday}
          canPick={(d) => !!owner(d)} onDay={(d) => { const t = owner(d); if (t) navigate(`/trip/${t.id}?day=${d}`) }} />
      </div>
      {aside?.(m)}
    </div>
  )
}
