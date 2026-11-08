import { useEffect, useId, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

type Lists = { countries: string[]; cities: string[]; trips: string[] }
type Key = keyof Lists

// the numbers along the bottom of the travels card, labelled by its heading; hovering, focusing or tapping
// one shows the globe's tooltip listing what it counts
export function Totals({ countries, cities, trips, lists, labelledBy }: { countries: number; cities: number; trips: number; lists: Lists; labelledBy: string }) {
  const tipId = useId()
  const [open, setOpenKey] = useState<Key | null>(null)
  // the tip floats above the page (fixed, in body), kept inside the window, so showing it never moves anything
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)
  const setOpen = (k: Key | null, el?: HTMLElement) => {
    setOpenKey(k)
    if (k && el) { const r = el.getBoundingClientRect(); setAt({ x: r.left + r.width / 2, y: r.top }) }
  }
  const items: [Key, number][] = [['countries', countries], ['cities', cities], ['trips', trips]]
  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null) }
    const away = (e: PointerEvent) => { if (!(e.target as Element | null)?.closest?.('.totals')) setOpen(null) }
    const gone = () => setOpenKey(null)
    window.addEventListener('keydown', key)
    window.addEventListener('pointerdown', away)
    window.addEventListener('scroll', gone, true)
    window.addEventListener('resize', gone)
    return () => {
      window.removeEventListener('keydown', key); window.removeEventListener('pointerdown', away)
      window.removeEventListener('scroll', gone, true); window.removeEventListener('resize', gone)
    }
  }, [open])
  return (
    <dl className="totals" data-testid="totals" aria-labelledby={labelledBy}>
      {items.map(([label, n]) => (
        <div key={label} tabIndex={0} className="total" aria-describedby={open === label ? tipId : undefined}
          onMouseEnter={(e) => setOpen(label, e.currentTarget)} onMouseLeave={() => setOpen(null)}
          onFocus={(e) => setOpen(label, e.currentTarget)} onBlur={() => setOpen(null)}
          onClick={(e) => setOpen(label, e.currentTarget)}>
          <dt className="num head">{n}</dt>
          <dd className="muted">{label}</dd>
          {open === label && at && lists[label].length > 0 && createPortal(
            <div id={tipId} role="tooltip" className="globe-tip totals-tip"
              style={{ position: 'fixed', left: Math.min(Math.max(at.x, 140), window.innerWidth - 140), top: at.y, '--arrow': `${at.x - Math.min(Math.max(at.x, 140), window.innerWidth - 140)}px` } as CSSProperties}>
              <strong className="head">{n} {label}</strong>
              <span>{lists[label].join(' · ')}</span>
            </div>,
            document.body,
          )}
        </div>
      ))}
    </dl>
  )
}
