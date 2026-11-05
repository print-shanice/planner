import { Icon } from '../../components/Icon'

export type Tab = 'plan' | 'map' | 'money' | 'saved' | 'packing'
export const PHONE_TABS: Tab[] = ['plan', 'map', 'money', 'saved', 'packing']
export const WIDE_TABS: Tab[] = ['plan', 'money', 'saved', 'packing']

type Props = { tabs: Tab[]; value: Tab; onChange: (t: Tab) => void; variant: 'bottom' | 'top' }

export function TripTabs({ tabs, value, onChange, variant }: Props) {
  return (
    <div role="tablist" aria-label="sections" className={`tabs tabs-${variant}`}>
      {tabs.map((t) => (
        <button key={t} type="button" role="tab" id={`tab-${t}`} aria-selected={value === t} aria-controls="tab-panel"
          className="tab" onClick={() => onChange(t)}>
          {variant === 'bottom' && <Icon name={t} size={22} />}
          <span>{t}</span>
        </button>
      ))}
    </div>
  )
}
