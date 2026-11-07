import { useEffect, useRef } from 'react'
import { dayLabel } from '../../components/MonthCalendar'
import { fmtDay } from '../../lib/dates'

export function DayStrip({ days, selected, onPick }: { days: string[]; selected: string; onPick: (day: string) => void }) {
  const strip = useRef<HTMLElement>(null)
  const active = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const row = strip.current
    const button = active.current
    if (!row || !button) return
    // Scroll this row only, without moving the itinerary vertically.
    row.scrollLeft += button.getBoundingClientRect().left - row.getBoundingClientRect().left - (row.clientWidth - button.offsetWidth) / 2
  }, [selected])

  return (
    <nav ref={strip} className="day-strip" aria-label="days">
      {days.map(day => (
        <button ref={day === selected ? active : undefined} type="button" key={day}
          aria-label={dayLabel(day)} aria-current={day === selected ? 'date' : undefined} onClick={() => onPick(day)}>
          <span>{fmtDay(day, { weekday: 'short' })}</span>
          <strong className="num">{+day.slice(8)}</strong>
          <span>{fmtDay(day, { month: 'short' })}</span>
        </button>
      ))}
    </nav>
  )
}
