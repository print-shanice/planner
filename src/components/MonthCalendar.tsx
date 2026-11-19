import type { CSSProperties, ReactNode } from 'react'
import { monthWeeks, type Span } from '../lib/calendar'
import { dayLabel, fmtDay } from '../lib/dates'
import { Icon } from './Icon'
import { CountryFlag } from './CountryFlag'
import { colourVar } from '../lib/colors'

export const tint = (color: number | null | undefined) => ({ '--c': colourVar(color) }) as CSSProperties
const WEEKDAYS = ['m', 't', 'w', 't', 'f', 's', 's']

type Props = {
  // the month in the title
  month: string
  // move back or on by a month; missing means you can't
  onPrev?: () => void
  onNext?: () => void
  today: string
  // the trip whose ribbon a day sits on
  ribbon: (d: string) => Span | undefined
  selected?: string | null
  // days become buttons when set; only days that pass `canPick`
  onDay?: (d: string) => void
  canPick?: (d: string) => boolean
  // days with something planned get a dot
  marked?: (d: string) => boolean
  // the flag a ribbon wears: it sits on the first day of every stretch of that ribbon, row by row,
  // so each colour on the month says which country it is
  flag?: (s: Span) => string | null | undefined
  // a public holiday that day where you'll be: a short amber rule under the day, and its name read out
  holiday?: (d: string) => string | null | undefined
  // one of your own holidays that day: the same amber rule as a public one, and its name read out
  off?: (d: string) => string | null | undefined
  // days being marked: the first and (once tapped) the last, outlined as one stretch
  picked?: [string, string | null] | null
  // words before the month's arrows ("add a holiday")
  tools?: ReactNode
}

function Week({ week, p }: { week: (string | null)[]; p: Props }) {
  const owners = week.map((d) => (d ? p.ribbon(d) : undefined))
  return (
    <div className="cal-week">
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
        const [from, to] = p.picked ?? []
        const inPick = !!from && (to ? d >= from && d <= to : d === from)
        const pickEdge = inPick ? `${i === 0 || d === from ? 'l' : ''}${i === 6 || d === (to ?? from) ? 'r' : ''}` : ''
        const off = p.off?.(d)
        const attrs = {
          'data-day': d, 'data-ribbon': ribbon, 'data-edge': edge || undefined, 'data-past': d < p.today || undefined,
          'aria-current': d === p.today ? ('date' as const) : undefined,
          'data-planned': p.marked?.(d) || undefined,
          'data-holiday': p.holiday?.(d) ? '' : undefined,
          'data-off': off ? '' : undefined,
          'data-picked': inPick ? pickEdge || '-' : undefined,
          title: [p.holiday?.(d), off].filter(Boolean).join(' · ') || undefined,
          style: { gridColumn: i + 1, ...(t ? tint(t.color) : {}) },
        }
        const code = t && edge.includes('l') ? p.flag?.(t) : null
        const n = <>{inPick && <span className="cal-pick" aria-hidden="true" />}<span className="cal-n num">{+d.slice(8)}</span>{code && <span className="cal-flag"><CountryFlag code={code} /></span>}</>
        const pickable = p.canPick?.(d) ?? true
        if (p.onDay && pickable) {
          return (
            <button key={d} type="button" className="cal-day" {...attrs} aria-label={[dayLabel(d), p.holiday?.(d), off].filter(Boolean).join(' · ')}
              aria-pressed={p.picked ? inPick : p.selected === d} onClick={() => p.onDay!(d)}>
              {n}
            </button>
          )
        }
        return <span key={d} className="cal-day" {...attrs} data-out={(p.onDay && !pickable) || undefined}>{n}</span>
      })}
    </div>
  )
}

export function MonthCalendar(p: Props) {
  const m = p.month
  const name = fmtDay(`${m}-01`, { month: 'long', year: 'numeric' })
  return (
    <div className="cal" data-testid="calendar" role="group" aria-label={name}>
      <div className="cal-head">
        <p className="cal-title head" aria-live="polite">
          <span className="cal-month">{fmtDay(`${m}-01`, { month: 'long' })}</span>{' '}
          <span className="cal-year">{m.slice(0, 4)}</span>
        </p>
        {p.tools}
        <button type="button" className="icon-btn" aria-label="previous month" disabled={!p.onPrev} onClick={p.onPrev}>
          <Icon name="back" />
        </button>
        <button type="button" className="icon-btn" aria-label="next month" disabled={!p.onNext} onClick={p.onNext}>
          <Icon name="next" />
        </button>
      </div>
      <div className="cal-grid" key={m} aria-hidden={p.onDay ? undefined : true}>
        <div className="cal-weekdays" aria-hidden="true">{WEEKDAYS.map((d, i) => <span key={i}>{d}</span>)}</div>
        {monthWeeks(m).map((w, i) => <Week key={i} week={w} p={p} />)}
      </div>
    </div>
  )
}
