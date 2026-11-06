import type { PlanItem } from '../../lib/calendar'
import { fmtDay } from '../../lib/dates'
import { dayLabel, tint } from '../../components/MonthCalendar'

export const itemId = (i: PlanItem) => (i.kind === 'fold' ? `fold-${i.trip.id}` : `day-${i.date}`)
export const jumpTo = (id: string) => document.getElementById(id)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })

export function DayChips({ items, selected }: { items: PlanItem[]; selected?: string | null }) {
  if (!items.length) return null
  return (
    <nav className="chips" aria-label="days">
      {items.map((i) => (i.kind === 'fold' ? (
        <button key={itemId(i)} type="button" className="chip chip-trip" style={tint(i.trip.color)} onClick={() => jumpTo(itemId(i))}>
          <span className="dot" />
          <span>{i.trip.name}</span>
        </button>
      ) : (
        <button key={itemId(i)} type="button" className="chip" aria-label={dayLabel(i.date)}
          aria-current={selected === i.date ? 'true' : undefined} onClick={() => jumpTo(itemId(i))}>
          <span className="muted">{fmtDay(i.date, { weekday: 'short' })}</span>
          <span className="num">{+i.date.slice(8)}</span>
          <span className="muted">{fmtDay(i.date, { month: 'short' })}</span>
        </button>
      )))}
    </nav>
  )
}
