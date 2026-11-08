import { useEffect, useState } from 'react'
import type { SavedView, Tab } from './tabs'
import { Icon } from '../../components/Icon'

const ICON: Record<Tab, string> = { plan: 'calendar', map: 'map', money: 'money', saved: 'saved' }
export type Section = { label: string; tab: Tab; view?: SavedView }

// phones: a bar of four at the bottom; laptops: one quiet row of text tabs (ideas, links and packing
// each get their own, and the map is always beside)
export function TripSummary({ sections, active, onPick, bar }: { sections: Section[]; active: string; onPick: (s: Section) => void; bar: boolean }) {
  // the tapped tab lights up straight away, on its own, while the page catches up
  const [tapped, setTapped] = useState<string | null>(null)
  useEffect(() => { setTapped(null) }, [active])
  const on = tapped ?? active
  return (
    <nav className={bar ? 'tab-bar' : 'section-tabs'} aria-label="trip sections">
      {sections.map((s) => (
        <button key={s.label} type="button" aria-pressed={on === s.label} onClick={() => { setTapped(s.label); onPick(s) }}>
          {bar && <Icon name={ICON[s.tab]} size={24} />}
          <span>{s.label}</span>
        </button>
      ))}
    </nav>
  )
}
