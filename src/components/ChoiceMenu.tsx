import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { tint } from './MonthCalendar'
import { Icon, type IconName } from './Icon'

// an icon in place of the dot marks a choice that makes something new (it sits apart, above the rest)
export type Choice = { value: string; label: string; color?: number; depth?: number; icon?: IconName }

type Props = { label: string; ariaLabel: string; options: Choice[]; onPick: (value: string) => void; disabled?: boolean; className?: string }

// the planner's own dropdown: reads as a text link, opens a list that floats above the page (so no scrolling list cuts it off)
export function ChoiceMenu({ label, ariaLabel, options, onPick, disabled, className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState<{ top: number; left: number; up: boolean } | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const id = useId()

  const close = (refocus = true) => { setOpen(false); if (refocus) button.current?.focus() }
  const items = () => [...(list.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])]

  // sits under the button, right edges lined up; turns upwards when there isn't room below
  useLayoutEffect(() => {
    if (!open || !button.current) return
    const r = button.current.getBoundingClientRect()
    const h = Math.min(320, options.length * 46 + 12)
    const up = r.bottom + h + 8 > window.innerHeight && r.top > h + 8
    setAt({ top: up ? r.top - h - 6 : r.bottom + 6, left: Math.max(8, r.right - 240), up })
  }, [open, options.length])

  useEffect(() => {
    if (!open) return
    items()[0]?.focus()
    const away = (e: PointerEvent) => {
      const t = e.target as Node
      if (!list.current?.contains(t) && !button.current?.contains(t)) close(false)
    }
    // the page moving under it closes it; its own list scrolling (a long run of trips) does not
    const gone = (e: Event) => { if (e.target instanceof Node && list.current?.contains(e.target)) return; close(false) }
    document.addEventListener('pointerdown', away)
    window.addEventListener('resize', gone)
    window.addEventListener('scroll', gone, true)
    return () => {
      document.removeEventListener('pointerdown', away)
      window.removeEventListener('resize', gone)
      window.removeEventListener('scroll', gone, true)
    }
  }, [open])

  function keys(e: KeyboardEvent<HTMLUListElement>) {
    const all = items()
    const i = all.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'ArrowDown') { e.preventDefault(); all[Math.min(all.length - 1, i + 1)]?.focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); all[Math.max(0, i - 1)]?.focus() }
    else if (e.key === 'Home') { e.preventDefault(); all[0]?.focus() }
    else if (e.key === 'End') { e.preventDefault(); all.at(-1)?.focus() }
    else if (e.key === 'Escape') { e.preventDefault(); close() }
    else if (e.key === 'Tab') close(false)
  }

  function pick(value: string) {
    close()
    onPick(value)
  }

  return (
    <>
      <button ref={button} type="button" className={`text-select choice-menu ${className}`.trim()} aria-label={ariaLabel} aria-haspopup="listbox"
        aria-expanded={open} aria-controls={open ? id : undefined} disabled={disabled} onClick={() => setOpen((o) => !o)}>
        {label}
      </button>
      {open && createPortal(
        <ul ref={list} id={id} role="listbox" aria-label={ariaLabel} className={`choice-list${at?.up ? ' up' : ''}`} onKeyDown={keys}
          style={{ position: 'fixed', top: at?.top ?? 0, left: at?.left ?? 0, visibility: at ? 'visible' : 'hidden' }}>
          {options.map((o) => (
            <li key={o.value} role="option" aria-selected={false} tabIndex={-1} data-depth={o.depth ?? 0} className={o.icon ? 'choice choice-make' : 'choice'}
              style={o.color != null ? tint(o.color) : undefined}
              onClick={() => pick(o.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(o.value) } }}>
              {o.icon ? <Icon name={o.icon} size={16} /> : o.color != null && <span className="dot" aria-hidden="true" />}
              <span className="choice-label">{o.label}</span>
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </>
  )
}
