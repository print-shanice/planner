import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { openLayer } from '../lib/layers'

type Props = { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }

export function Sheet({ open, title, onClose, children, footer }: Props) {
  const id = useId()
  const panel = useRef<HTMLDivElement>(null)
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

  if (!open) return null
  return createPortal(
    <div className="app sheet-root">
      <div className="sheet-backdrop"
        onMouseDown={(e) => { downOnBackdrop.current = e.target === e.currentTarget }}
        onClick={(e) => { if (e.target === e.currentTarget && downOnBackdrop.current) onClose() }}>
        <div ref={panel} className="sheet" role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}>
          <header className="sheet-head">
            <h2 id={id} className="head">{title}</h2>
            <button type="button" className="icon-btn sheet-x" aria-label="close" onClick={onClose}><Icon name="close" /></button>
          </header>
          <div className="sheet-body">{children}</div>
          {footer && <footer className="sheet-foot">{footer}</footer>}
        </div>
      </div>
    </div>,
    document.body,
  )
}
