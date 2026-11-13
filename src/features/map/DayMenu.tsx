import { useId, useRef, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { dayLabel, fmtDay } from '../../lib/dates'
import { Icon } from '../../components/Icon'
import { usePopupList } from '../../components/usePopupList'

export type DayChoice = { date: string; sub: string }

const month = (d: string) => fmtDay(d, { month: 'long', year: 'numeric' })

// which day a place goes on: the planner's own dropdown (never a native select). every day of the trip in full,
// with what's on it underneath, months headed on long trips, then "no date". typing a few letters or a date jumps there
export function DayMenu({ days, value, onPick }: { days: DayChoice[]; value: string; onPick: (date: string) => void }) {
  const menu = usePopupList({ height: Math.min(340, (days.length + 1) * 52 + 12), width: (r) => Math.max(r.width, 260), align: 'left' })
  const typed = useRef({ text: '', at: 0 })
  const id = useId()
  const label = value ? dayLabel(value) : 'no date'
  const months = new Set(days.map((d) => month(d.date))).size > 1

  function pick(date: string) {
    menu.close(false)
    onPick(date)
  }

  function keys(e: KeyboardEvent<HTMLUListElement>) {
    if (menu.keys(e) || e.key.length !== 1 || !/[\p{L}\d ]/u.test(e.key)) return
    // "21", "sun", "mon 2": the first day whose words start with what was typed
    const now = Date.now()
    typed.current = { text: (now - typed.current.at < 800 ? typed.current.text : '') + e.key.toLowerCase(), at: now }
    const t = typed.current.text.trim()
    const all = [...(menu.list.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])]
    all.find((o) => (o.dataset.words ?? '').split(' ').some((_, k, ws) => ws.slice(k).join(' ').startsWith(t)))?.focus()
  }

  let lastMonth = ''
  return (
    <>
      <button ref={menu.button} type="button" className="day-menu" aria-label={`day: ${label}`} aria-haspopup="listbox" aria-expanded={menu.open}
        aria-controls={menu.open ? id : undefined} onClick={() => menu.setOpen(!menu.open)}>
        <span>{label}</span><Icon name="chevron" size={16} />
      </button>
      {menu.open && createPortal(
        <ul ref={menu.list} id={id} role="listbox" aria-label="day" className="day-list" onKeyDown={keys} style={menu.style}>
          {days.map((d) => {
            const m = month(d.date)
            const head = months && m !== lastMonth ? m : null
            lastMonth = m
            const full = fmtDay(d.date, { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '')
            return [
              head && <li key={`m-${m}`} role="presentation" className="day-month mono-label">{head}</li>,
              <li key={d.date} role="option" aria-selected={d.date === value} tabIndex={-1} data-words={full} className="day-option"
                onClick={() => pick(d.date)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(d.date) } }}>
                <span>{full}</span>{d.sub && <span className="day-sub">{d.sub}</span>}
              </li>,
            ]
          })}
          <li role="option" aria-selected={!value} tabIndex={-1} data-words="no date" className="day-option"
            onClick={() => pick('')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick('') } }}>
            <span>no date</span><span className="day-sub">keep it as an idea</span>
          </li>
        </ul>,
        document.body,
      )}
    </>
  )
}
