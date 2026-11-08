import { useState } from 'react'
import { fmtDay, todayISO } from '../lib/dates'
import { monthWeeks, shiftMonth } from '../lib/calendar'
import { Sheet } from './Sheet'
import { Icon } from './Icon'
import { dayLabel } from './MonthCalendar'

type Props = { type: 'date' | 'time'; label: string; value: string; onChange: (v: string) => void; min?: string }

const shown = (type: Props['type'], v: string) => (type === 'date' ? fmtDay(v, { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '') : v)
const WEEKDAYS = ['m', 't', 'w', 't', 'f', 's', 's']

// a date or a time. a date opens the app's own calendar (a labelled input stays underneath for screen readers
// and forms); a time keeps the phone's own wheel, which is already good
export function Pick({ type, label, value, onChange, min }: Props) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => (value || min || todayISO()).slice(0, 7))
  if (type === 'time') {
    return (
      <label className="pick time" data-empty={value ? undefined : ''}>
        <span className="pick-text" aria-hidden>{value || 'time'}</span>
        <input type="time" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}
          onClick={(e) => { try { e.currentTarget.showPicker() } catch { /* not every browser can */ } }} />
      </label>
    )
  }
  const pick = (d: string) => { onChange(d); setOpen(false) }
  return (
    <span className="pick date" data-empty={value ? undefined : ''}>
      <button type="button" className="pick-open" aria-label={`choose ${label}${value ? `, ${shown('date', value)}` : ''}`}
        onClick={() => { setMonth((value || min || todayISO()).slice(0, 7)); setOpen(true) }}>
        <span className="pick-text">{value ? shown('date', value) : 'date'}</span>
      </button>
      <input type="date" className="sr-only" tabIndex={-1} aria-label={label} value={value} min={min} onChange={(e) => onChange(e.target.value)} />
      <Sheet open={open} title={label} onClose={() => setOpen(false)}>
        <div className="datepick">
          <div className="datepick-head">
            <p className="head"><span className="cal-month">{fmtDay(`${month}-01`, { month: 'long' })}</span> <span className="cal-year">{month.slice(0, 4)}</span></p>
            <button type="button" className="icon-btn" aria-label="previous month" onClick={() => setMonth(shiftMonth(month, -1))}><Icon name="back" /></button>
            <button type="button" className="icon-btn" aria-label="next month" onClick={() => setMonth(shiftMonth(month, 1))}><Icon name="next" /></button>
          </div>
          <div className="datepick-grid">
            {WEEKDAYS.map((w, i) => <span key={`w${i}`} className="datepick-wd">{w}</span>)}
            {monthWeeks(month).flat().map((d, i) => d
              ? <button key={d} type="button" className="datepick-day num" aria-label={dayLabel(d)} aria-pressed={d === value}
                  data-span={min && value && d > min && d < value ? '' : undefined} data-from={d === min ? '' : undefined}
                  aria-current={d === todayISO() ? 'date' : undefined} disabled={!!min && d < min} onClick={() => pick(d)}>{+d.slice(8)}</button>
              : <span key={`e${i}`} />)}
          </div>
          {value && <button type="button" className="btn ghost small datepick-clear" onClick={() => pick('')}>no date</button>}
        </div>
      </Sheet>
    </span>
  )
}
