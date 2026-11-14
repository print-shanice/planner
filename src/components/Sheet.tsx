import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { openLayer } from '../lib/layers'

// undefined: not in a sheet; null: in a sheet whose footer isn't mounted yet
const Slot = createContext<HTMLElement | null | undefined>(undefined)

// puts its children in the sheet's fixed footer, so save stays in view however long the form is
export function SheetFooter({ children }: { children: ReactNode }) {
  const slot = useContext(Slot)
  if (slot === undefined) return <>{children}</>
  return slot ? createPortal(children, slot) : null
}

// page: a form opens full screen on a phone, with save at the top
// side: on a laptop trip it's a panel on the right, over the map, so the plan stays in view (forms are too)
// heading: something to show in place of the title's words, such as a name you can type over; title still names the sheet
type Props = { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; page?: boolean; side?: boolean; heading?: ReactNode }

export function Sheet({ open, title, onClose, children, footer, page, side, heading }: Props) {
  const id = useId()
  const panel = useRef<HTMLDivElement>(null)
  const backdrop = useRef<HTMLDivElement>(null)
  const [foot, setFoot] = useState<HTMLElement | null>(null)
  const downOnBackdrop = useRef(false)
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    if (!open) return
    const before = document.activeElement as HTMLElement | null
    const el = panel.current
    // a field is ready to type into; a sheet of buttons focuses itself, so no focus ring shows on open.
    // a card's fields (data-quiet) wait to be tapped, so a phone's keyboard doesn't jump up
    const first = el?.querySelector<HTMLElement>('input:not([tabindex="-1"]):not([data-quiet]):not([hidden]), textarea:not([data-quiet]), select:not([data-quiet])')
    ;(first ?? el)?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && el) {
        const items = [...el.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])')]
        if (!items.length) return
        const a = items[0], b = items[items.length - 1]
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); b.focus() }
        else if (!e.shiftKey && document.activeElement === b) { e.preventDefault(); a.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    const off = openLayer(() => close.current())
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      off()
      document.body.style.overflow = overflow
      before?.focus?.()
    }
  }, [open])

  // the iphone keyboard covers fixed sheets; lift the sheet by the part of the screen it takes
  useEffect(() => {
    const vv = window.visualViewport
    const el = backdrop.current
    if (!open || !vv || !el) return
    const fit = () => el.style.setProperty('--kb', `${Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))}px`)
    fit()
    vv.addEventListener('resize', fit)
    vv.addEventListener('scroll', fit)
    return () => { vv.removeEventListener('resize', fit); vv.removeEventListener('scroll', fit) }
  }, [open])

  if (!open) return null
  return createPortal(
    <div className={`app sheet-root${page ? ' page' : ''}${side ? ' side' : ''}`}>
      <div ref={backdrop} className="sheet-backdrop"
        onMouseDown={(e) => { downOnBackdrop.current = e.target === e.currentTarget }}
        onClick={(e) => { if (e.target === e.currentTarget && downOnBackdrop.current) onClose() }}>
        <div ref={panel} className={`sheet${page ? ' page' : ''}${side ? ' side' : ''}`} role="dialog" aria-modal="true" aria-labelledby={heading ? undefined : id} aria-label={heading ? title : undefined} tabIndex={-1}>
          <header className="sheet-head">
            {heading ? <div className="sheet-title">{heading}</div> : <h2 id={id} className="head">{title}</h2>}
            <button type="button" className="icon-btn sheet-x" aria-label="close" onClick={onClose}><Icon name="close" /></button>
          </header>
          <div className="sheet-body"><Slot.Provider value={foot}>{children}</Slot.Provider></div>
          <footer ref={setFoot} className="sheet-foot">{footer}</footer>
        </div>
      </div>
    </div>,
    document.body,
  )
}
