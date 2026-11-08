import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Trip } from '../../lib/types'
import { countdown, fmtRange } from '../../lib/dates'
import { innermostDay, monthTree, openingMonth, shiftMonth, tripSpan, type Span } from '../../lib/calendar'
import { MonthCalendar, tint } from '../../components/MonthCalendar'

const spans = (ts: Trip[]) => ts.map(tripSpan).filter((x): x is Span => !!x)

function when(t: Trip, today: string): string {
  if (t.parent_id) return ''
  const cd = countdown(t, today)
  if (cd.kind === 'upcoming') return `in ${cd.days} ${cd.days === 1 ? 'day' : 'days'}`
  if (cd.kind === 'ongoing') return `day ${cd.days}`
  return ''
}

export function Calendar({ trips, today }: { trips: Trip[]; today: string }) {
  const [month, setMonth] = useState(() => openingMonth(trips, today))
  // a first trip added while home is open gives the calendar a month
  const m = month ?? openingMonth(trips, today)

  const tree = m ? monthTree(m, trips) : []
  const listed = new Set(tree.map((r) => r.trip.id))
  const rest = trips
    .filter((t) => !t.parent_id && !listed.has(t.id) && countdown(t, today).kind !== 'done')
    .sort((a, b) => (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999') || a.name.localeCompare(b.name))
  const rows = [...tree, ...rest.map((trip) => ({ trip, depth: 0 }))]

  // each day shows only its innermost trip, drawn like any trip; the list under the calendar shows how they nest
  const all = useMemo(() => spans(trips), [trips])
  const depth = useMemo(() => {
    const byId = new Map(trips.map((t) => [t.id, t]))
    const of = (t: Trip | undefined, n = 0): number => (t?.parent_id && n < 20 ? of(byId.get(t.parent_id), n + 1) : n)
    return (s: Span) => of(s.trip)
  }, [trips])

  return (
    <div className="cal-wrap">
      {m && (
        <MonthCalendar month={m} onPrev={() => setMonth(shiftMonth(m, -1))} onNext={() => setMonth(shiftMonth(m, 1))}
          today={today} ribbon={(d) => innermostDay(d, all, depth)} bars={[]} />
      )}
      {rows.length > 0 && (
        <div className="rows">
          {rows.map(({ trip: t, depth }) => {
            const dates = fmtRange(t.start_date, t.end_date)
            const extra = [dates, when(t, today)].filter(Boolean).join(' · ')
            return (
              <Link
                key={t.id} to={`/trip/${t.id}`} className="trip-row cal-row" data-testid="cal-row" data-depth={depth}
                style={{ paddingLeft: 18 + depth * 22 }}
              >
                <span className="dot" style={tint(t.color)} />
                <span className="cal-row-text">
                  <span className="trip-row-name">{t.name}</span>
                  {extra && <span className="muted num">{extra}</span>}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
