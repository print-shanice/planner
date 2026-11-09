import { useEffect, useState } from 'react'
import { TAB_ICON, type Tab } from './tabs'
import { Icon } from '../../components/Icon'

// the tapped tab is painted first; the switch (and totoro) starts only after the browser has shown it,
// so the highlight never waits behind the new section's work
function afterPaint(fn: () => void) {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(fn, 0))
  else setTimeout(fn, 0)
}

// phones: a bar at the bottom; laptops: one quiet row of underlined words under the title
export function TripSummary({ tabs, active, onPick, bar }: { tabs: Tab[]; active: Tab; onPick: (t: Tab) => void; bar: boolean }) {
  // the tapped tab lights up straight away, on its own, while the page catches up
  const [tapped, setTapped] = useState<Tab | null>(null)
  useEffect(() => { setTapped(null) }, [active])
  const on = tapped ?? active
  return (
    <nav className={bar ? 'tab-bar' : 'section-tabs'} aria-label="trip sections">
      {tabs.map((t) => (
        <button key={t} type="button" aria-current={on === t ? 'page' : undefined} aria-pressed={on === t} onClick={() => { setTapped(t); afterPaint(() => onPick(t)) }}>
          {bar && <Icon name={TAB_ICON[t]} size={22} />}
          <span>{t}</span>
        </button>
      ))}
    </nav>
  )
}
