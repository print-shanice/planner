import type { Tab } from './tabs'

export function TripSummary({ sections, active, onPick }: { sections: Tab[]; active: Tab; onPick: (tab: Tab) => void }) {
  return (
    <nav className="section-nav" aria-label="trip sections">
      {sections.map((section) => (
        <button key={section} type="button" aria-pressed={active === section}
           onClick={() => onPick(section)}>
          {section === 'plan' ? 'calendar' : section}
        </button>
      ))}
    </nav>
  )
}
