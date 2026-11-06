import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { Trip } from '../../lib/types'
import { countdown, fmtDay, fmtRange } from '../../lib/dates'
import { monthTree, monthWeeks, openingMonth, ribbonDay, shiftMonth, weekBars } from '../../lib/calendar'
import { Icon } from '../../components/Icon'

const tint = (t: Trip) => ({ '--c': `var(--g${(((t.color ?? 0) % 6) + 6) % 6})` }) as CSSProperties
const WEEKDAYS = ['m', 't', 'w', 't', 'f', 's', 's']

function when(t: Trip, today: string): string {
  if (t.parent_id) return ''
  const cd = countdown(t, today)
  if (cd.kind === 'upcoming') return `in ${cd.days} ${cd.days === 1 ? 'day' : 'days'}`
  if (cd.kind === 'ongoing') return `day ${cd.days}`
  return ''
}

function Week({ week, tops, sides, today }: { week: (string | null)[]; tops: Trip[]; sides: Trip[]; today: string }) {
  const owners = week.map((d) => (d ? ribbonDay(d, tops) : undefined))
  const bars = weekBars(week, sides)
  // a week only makes room for the side trips it has
  const lanes = bars.reduce((n, b) => Math.max(n, b.lane + 1), 0)
  return (
    <div className="cal-week" style={{ gridTemplateRows: `44px${lanes ? ` repeat(${lanes}, 20px)` : ''}` }}>
      {week.map((d, i) => {
        if (!d) return <span key={i} className="cal-day" style={{ gridColumn: i + 1 }} />
        const t = owners[i]
        let ribbon: string | undefined
        let edge = ''
        if (t) {
          const first = d === t.start_date
          const last = d === (t.end_date ?? t.start_date)
          ribbon = first && last ? 'one' : first ? 'start' : last ? 'end' : 'on'
          if (owners[i - 1] !== t) edge += 'l'
          if (owners[i + 1] !== t) edge += 'r'
        }
        return (
          <span
            key={d} className="cal-day" data-day={d} data-ribbon={ribbon} data-edge={edge || undefined}
            data-past={d < today || undefined} aria-current={d === today ? 'date' : undefined}
            style={{ gridColumn: i + 1, ...(t ? tint(t) : {}) }}
          >
            <span className="cal-n num">{+d.slice(8)}</span>
          </span>
        )
      })}
      {bars.map((b) => (
        <Link
          key={b.trip.id} to={`/trip/${b.trip.id}`} tabIndex={-1} className="cal-bar" data-testid="cal-bar"
          data-starts={b.starts || undefined} data-ends={b.ends || undefined} title={b.trip.name}
          style={{ gridColumn: `${b.from + 1} / ${b.to + 2}`, gridRow: b.lane + 2, ...tint(b.trip) }}
        >
          {b.trip.name}
        </Link>
      ))}
    </div>
  )
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

  const weeks = m ? monthWeeks(m) : []
  const tops = trips.filter((t) => !t.parent_id)
  const sides = trips.filter((t) => t.parent_id)

  return (
    <div className="cal-wrap">
      {m && (
        <div className="cal" data-testid="calendar" role="group" aria-label={`${fmtDay(`${m}-01`, { month: 'long', year: 'numeric' })}`}>
          <div className="cal-head">
            <p className="cal-title head" aria-live="polite">
              <span className="cal-month">{fmtDay(`${m}-01`, { month: 'long' })}</span>{' '}
              <span className="cal-year">{m.slice(0, 4)}</span>
            </p>
            <button type="button" className="icon-btn" aria-label="previous month" onClick={() => setMonth(shiftMonth(m, -1))}>
              <Icon name="back" />
            </button>
            <button type="button" className="icon-btn" aria-label="next month" onClick={() => setMonth(shiftMonth(m, 1))}>
              <Icon name="next" />
            </button>
          </div>
          <div className="cal-grid" key={m} aria-hidden="true">
            <div className="cal-weekdays">{WEEKDAYS.map((d, i) => <span key={i}>{d}</span>)}</div>
            {weeks.map((w, i) => <Week key={i} week={w} tops={tops} sides={sides} today={today} />)}
          </div>
        </div>
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
                <span className="dot" style={tint(t)} />
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
