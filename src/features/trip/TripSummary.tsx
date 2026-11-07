import type { Tab } from './tabs'
import { Icon } from '../../components/Icon'

const ICON: Record<Tab, string> = { plan: 'calendar', map: 'map', money: 'money', saved: 'saved' }

// phones: a bar of four at the bottom; laptops: a switch under the title (the map is always beside)
export function TripSummary({ sections, active, onPick, bar }: { sections: Tab[]; active: Tab; onPick: (tab: Tab) => void; bar: boolean }) {
  return (
    <nav className={bar ? 'tab-bar' : 'section-switch'} aria-label="trip sections">
      {sections.map((section) => (
        <button key={section} type="button" aria-pressed={active === section} onClick={() => onPick(section)}>
          {bar && <Icon name={ICON[section]} size={24} />}
          <span>{section}</span>
        </button>
      ))}
    </nav>
  )
}
