import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { fmtDay } from '../../lib/dates'
import { dayLabel } from '../../components/MonthCalendar'
import { Icon } from '../../components/Icon'

export type DayChoice = { date: string; sub: string }

const month = (d: string) => fmtDay(d, { month: 'long', year: 'numeric' })

// which day a place goes on: the planner's own dropdown (never a native select). every day of the trip in full,
// with what's on it underneath, months headed on long trips, then "no date". typing a few letters or a date jumps there
export function DayMenu({ days, value, onPick }: { days: DayChoice[]; value: string; onPick: (date: string) => void }) {
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState<{ top: number; left: number; width: number } | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const typed = useRef({ text: '', at: 0 })
  const id = useId()
  const label = value ? dayLabel(value) : 'no date'
  const months = new Set(days.map((d) => month(d.date))).size > 1

  const close = (refocus = true) => { setOpen(false); if (refocus) button.current?.focus() }
  const items = () => [...(list.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])]

  useLayoutEffect(() => {
    if (!open || !button.current) return
    const r = button.current.getBoundingClientRect()
    const h = Math.min(340, (days.length + 1) * 52 + 12)
    const up = r.bottom + h + 8 > window.innerHeight && r.top > h + 8
    setAt({ top: up ? r.top - h - 6 : r.bottom + 6, left: r.left, width: Math.max(r.width, 260) })
  }, [open, days.length])

  useEffect(() => {
    if (!open) return
    const all = items()
    ;(all.find((o) => o.getAttribute('aria-selected') === 'true') ?? all[0])?.focus()
    const away = (e: PointerEvent) => {
      const t = e.target as Node
      if (!list.current?.contains(t) && !button.current?.contains(t)) close(false)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  function pick(date: string) {
    setOpen(false)
    onPick(date)
  }

  function keys(e: KeyboardEvent<HTMLUListElement>) {
    const all = items()
    const i = all.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'ArrowDown') { e.preventDefault(); all[Math.min(all.length - 1, i + 1)]?.focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); all[Math.max(0, i - 1)]?.focus() }
    else if (e.key === 'Home') { e.preventDefault(); all[0]?.focus() }
    else if (e.key === 'End') { e.preventDefault(); all.at(-1)?.focus() }
    else if (e.key === 'Escape') { e.preventDefault(); close() }
    else if (e.key === 'Tab') close(false)
    else if (e.key.length === 1 && /[\p{L}\d ]/u.test(e.key)) {
      // "21", "sun", "mon 2": the first day whose words start with what was typed
      const now = Date.now()
      typed.current = { text: (now - typed.current.at < 800 ? typed.current.text : '') + e.key.toLowerCase(), at: now }
      const t = typed.current.text.trim()
      const hit = all.find((o) => (o.dataset.words ?? '').split(' ').some((_, k, ws) => ws.slice(k).join(' ').startsWith(t)))
      hit?.focus()
    }
  }

  let lastMonth = ''
  return (
    <>
      <button ref={button} type="button" className="day-menu" aria-label={`day: ${label}`} aria-haspopup="listbox" aria-expanded={open}
        aria-controls={open ? id : undefined} onClick={() => setOpen((o) => !o)}>
        <span>{label}</span><Icon name="chevron" size={16} />
      </button>
      {open && createPortal(
        <ul ref={list} id={id} role="listbox" aria-label="day" className="day-list" onKeyDown={keys}
          style={{ position: 'fixed', top: at?.top ?? 0, left: at?.left ?? 0, width: at?.width, visibility: at ? 'visible' : 'hidden' }}>
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
