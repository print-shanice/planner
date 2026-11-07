import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { monthWeeks, weekBars, type Span } from '../lib/calendar'
import { fmtDay } from '../lib/dates'
import { Icon } from './Icon'
import { CountryFlag } from './CountryFlag'

export const tint = (_color: number | null | undefined) => ({ '--c': 'var(--g0)' }) as CSSProperties
const WEEKDAYS = ['m', 't', 'w', 't', 'f', 's', 's']
export const dayLabel = (d: string) => fmtDay(d, { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '')

type Props = {
  // the month in the title
  month: string
  // one folded week instead of the whole month
  week?: string[]
  // move back or on by a month (a week when folded); missing means you can't
  onPrev?: () => void
  onNext?: () => void
  // phones fold the calendar to a week; this opens it to the whole month and back
  fold?: { open: boolean; onToggle: () => void }
  today: string
  // the trip whose ribbon a day sits on
  ribbon: (d: string) => Span | undefined
  // trips drawn as named bars in their colour; spans without a trip (cities) are grey
  bars: Span[]
  selected?: string | null
  // days become buttons when set; only days that pass `canPick`
  onDay?: (d: string) => void
  canPick?: (d: string) => boolean
  // days with something planned get a dot
  marked?: (d: string) => boolean
  // inside a trip, side-trip bars are real links with the side trip's flag
  linkBars?: boolean
}

function Week({ week, p }: { week: (string | null)[]; p: Props }) {
  const owners = week.map((d) => (d ? p.ribbon(d) : undefined))
  const bars = weekBars(week, p.bars)
  // a week only makes room for the bars it has
  const lanes = bars.reduce((n, b) => Math.max(n, b.lane + 1), 0)
  return (
    <div className="cal-week" style={{ gridTemplateRows: `44px${lanes ? ` repeat(${lanes}, 20px)` : ''}` }}>
      {week.map((d, i) => {
        if (!d) return <span key={i} className="cal-day" style={{ gridColumn: i + 1 }} />
        const t = owners[i]
        let ribbon: string | undefined
        let edge = ''
        if (t) {
          const first = d === t.start
          const last = d === t.end
          ribbon = first && last ? 'one' : first ? 'start' : last ? 'end' : 'on'
          if (owners[i - 1] !== t) edge += 'l'
          if (owners[i + 1] !== t) edge += 'r'
        }
        const attrs = {
          'data-day': d, 'data-ribbon': ribbon, 'data-edge': edge || undefined, 'data-past': d < p.today || undefined,
          'aria-current': d === p.today ? ('date' as const) : undefined,
          'data-planned': p.marked?.(d) || undefined,
          style: { gridColumn: i + 1, ...(t ? tint(t.color) : {}) },
        }
        const n = <span className="cal-n num">{+d.slice(8)}</span>
        const pickable = p.canPick?.(d) ?? true
        if (p.onDay && pickable) {
          return (
            <button key={d} type="button" className="cal-day" {...attrs} aria-label={dayLabel(d)}
              aria-pressed={p.selected === d} onClick={() => p.onDay!(d)}>
              {n}
            </button>
          )
        }
        return <span key={d} className="cal-day" {...attrs} data-out={(p.onDay && !pickable) || undefined}>{n}</span>
      })}
      {bars.map((b) => {
        const props = {
          className: `cal-bar${b.span.trip ? '' : ' city'}`, 'data-testid': b.span.trip ? 'cal-bar' : 'cal-city',
          'data-starts': b.starts || undefined, 'data-ends': b.ends || undefined, title: b.span.name,
          ...(p.linkBars ? {} : { 'aria-hidden': true }),
          style: { gridColumn: `${b.from + 1} / ${b.to + 2}`, gridRow: b.lane + 2, ...(b.span.trip ? tint(b.span.color) : {}) },
        }
        return b.span.trip
          ? <Link key={b.span.id} to={`/trip/${b.span.trip.id}`} tabIndex={p.linkBars ? undefined : -1} {...props}>
              {p.linkBars && b.starts && <CountryFlag code={b.span.trip.base?.country} />}{p.linkBars && b.starts ? ' ' : ''}{b.span.name}
            </Link>
          : <span key={b.span.id} {...props}>{b.span.name}</span>
      })}
    </div>
  )
}

export function MonthCalendar(p: Props) {
  const m = p.month
  const name = fmtDay(`${m}-01`, { month: 'long', year: 'numeric' })
  const step = p.week ? 'week' : 'month'
  const weeks = p.week ? [p.week] : monthWeeks(m)
  return (
    <div className={`cal${p.week ? ' folded' : ''}`} data-testid="calendar" role="group" aria-label={name}>
      <div className="cal-head">
        <p className="cal-title head" aria-live="polite">
          <span className="cal-month">{fmtDay(`${m}-01`, { month: 'long' })}</span>{' '}
          <span className="cal-year">{m.slice(0, 4)}</span>
        </p>
        <button type="button" className="icon-btn" aria-label={`previous ${step}`} disabled={!p.onPrev} onClick={p.onPrev}>
          <Icon name="back" />
        </button>
        <button type="button" className="icon-btn" aria-label={`next ${step}`} disabled={!p.onNext} onClick={p.onNext}>
          <Icon name="next" />
        </button>
        {p.fold && (
          <button type="button" className="icon-btn cal-fold" aria-label="whole month" aria-expanded={p.fold.open} onClick={p.fold.onToggle}>
            <Icon name="chevron" />
          </button>
        )}
      </div>
      <div className="cal-grid" key={p.week ? p.week[0] : m} aria-hidden={p.onDay ? undefined : true}>
        <div className="cal-weekdays" aria-hidden="true">{WEEKDAYS.map((d, i) => <span key={i}>{d}</span>)}</div>
        {weeks.map((w, i) => <Week key={i} week={w} p={p} />)}
      </div>
    </div>
  )
}
