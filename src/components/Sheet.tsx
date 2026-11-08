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

// page: a form opens full screen on a phone (the left column on a laptop), with save at the top
type Props = { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; page?: boolean }

export function Sheet({ open, title, onClose, children, footer, page }: Props) {
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
    const first = el?.querySelector<HTMLElement>('input, textarea, select, button:not(.sheet-x), [href]')
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
    <div className={`app sheet-root${page ? ' page' : ''}`}>
      <div ref={backdrop} className="sheet-backdrop"
        onMouseDown={(e) => { downOnBackdrop.current = e.target === e.currentTarget }}
        onClick={(e) => { if (e.target === e.currentTarget && downOnBackdrop.current) onClose() }}>
        <div ref={panel} className={`sheet${page ? ' page' : ''}`} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}>
          <header className="sheet-head">
            <h2 id={id} className="head">{title}</h2>
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
