import { Fragment, useId } from 'react'
import { createPortal } from 'react-dom'
import { tint } from './MonthCalendar'
import { Icon, type IconName } from './Icon'
import { usePopupList } from './usePopupList'

// an icon in place of the dot marks a choice that makes something new (it sits apart, above the rest);
// a section names the group a choice starts, shown once above it ("coming up", "past")
export type Choice = { value: string; label: string; color?: number; depth?: number; icon?: IconName; section?: string }

type Props = {
  label: string; ariaLabel: string; options: Choice[]; onPick: (value: string) => void; disabled?: boolean; className?: string
  // which edge the list lines up with (the button's right by default); selected is marked and opened on
  align?: 'left' | 'right'; selected?: string
}

// the planner's own dropdown: reads as a text link, opens a list that floats above the page (so no scrolling list cuts it off)
export function ChoiceMenu({ label, ariaLabel, options, onPick, disabled, className = '', align = 'right', selected }: Props) {
  const heads = options.filter((o, i) => o.section && o.section !== options[i - 1]?.section).length
  const menu = usePopupList({ height: Math.min(320, options.length * 46 + heads * 30 + 12), width: () => 240, align })
  const id = useId()

  function pick(value: string) {
    menu.close()
    onPick(value)
  }

  return (
    <>
      <button ref={menu.button} type="button" className={`text-select choice-menu ${className}`.trim()} aria-label={ariaLabel} aria-haspopup="listbox"
        aria-expanded={menu.open} aria-controls={menu.open ? id : undefined} disabled={disabled} onClick={() => menu.setOpen(!menu.open)}>
        {label}
      </button>
      {menu.open && createPortal(
        <ul ref={menu.list} id={id} role="listbox" aria-label={ariaLabel} className={`choice-list${align === 'left' ? ' left' : ''}${menu.up ? ' up' : ''}`} onKeyDown={menu.keys} style={menu.style}>
          {options.map((o, i) => (
            <Fragment key={o.value}>
              {o.section && o.section !== options[i - 1]?.section && <li role="presentation" className="choice-head">{o.section}</li>}
              <li role="option" aria-selected={o.value === selected} tabIndex={-1} data-depth={o.depth ?? 0} className={o.icon ? 'choice choice-make' : 'choice'}
                style={o.color != null ? tint(o.color) : undefined}
                onClick={() => pick(o.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(o.value) } }}>
                {o.icon ? <Icon name={o.icon} size={16} /> : o.color != null && <span className="dot" aria-hidden="true" />}
                <span className="choice-label">{o.label}</span>
              </li>
            </Fragment>
          ))}
        </ul>,
        document.body,
      )}
    </>
  )
}
