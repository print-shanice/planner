import { fmtDay } from '../../lib/dates'

type Props = { days: string[]; pick?: { min: string; max: string; onPick: (d: string) => void } }

export function DayChips({ days, pick }: Props) {
  const jump = (d: string) => document.getElementById(`day-${d}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  if (!days.length && !pick) return null
  return (
    <nav className="chips" aria-label="days">
      {days.map((d) => (
        <button key={d} type="button" className="chip" onClick={() => jump(d)}>
          <span className="muted">{fmtDay(d, { weekday: 'short' })}</span>
          <span className="num">{+d.slice(8)}</span>
        </button>
      ))}
      {pick && (
        <label className="chip chip-pick">
          <span>pick a date</span>
          <input type="date" aria-label="pick a date" min={pick.min} max={pick.max}
            onChange={(e) => { if (e.target.value) pick.onPick(e.target.value) }} />
        </label>
      )}
    </nav>
  )
}
