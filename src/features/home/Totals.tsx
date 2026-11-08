import { useEffect, useId, useState } from 'react'

type Lists = { countries: string[]; cities: string[]; trips: string[] }
type Key = keyof Lists

// the numbers along the bottom of the travels card, labelled by its heading; hovering, focusing or tapping
// one shows the globe's tooltip listing what it counts
export function Totals({ countries, cities, trips, lists, labelledBy }: { countries: number; cities: number; trips: number; lists: Lists; labelledBy: string }) {
  const tipId = useId()
  const [open, setOpen] = useState<Key | null>(null)
  const items: [Key, number][] = [['countries', countries], ['cities', cities], ['trips', trips]]
  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null) }
    const away = (e: PointerEvent) => { if (!(e.target as Element | null)?.closest?.('.totals')) setOpen(null) }
    window.addEventListener('keydown', key)
    window.addEventListener('pointerdown', away)
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('pointerdown', away) }
  }, [open])
  return (
    <dl className="totals" data-testid="totals" aria-labelledby={labelledBy}>
      {items.map(([label, n]) => (
        <div key={label} tabIndex={0} className="total" aria-describedby={open === label ? tipId : undefined}
          onMouseEnter={() => setOpen(label)} onMouseLeave={() => setOpen(null)}
          onFocus={() => setOpen(label)} onBlur={() => setOpen(null)}
          onClick={() => setOpen(label)}>
          <dt className="num head">{n}</dt>
          <dd className="muted">{label}</dd>
          {open === label && lists[label].length > 0 && (
            <div id={tipId} role="tooltip" className="globe-tip totals-tip">
              <strong className="head">{n} {label}</strong>
              <span>{lists[label].join(' · ')}</span>
            </div>
          )}
        </div>
      ))}
    </dl>
  )
}
