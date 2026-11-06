import { fmtDay } from '../lib/dates'

type Props = { type: 'date' | 'time'; label: string; value: string; onChange: (v: string) => void; min?: string }

const shown = (type: Props['type'], v: string) => (type === 'date' ? fmtDay(v, { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '') : v)

// a date or time as a calendar-style pill ("sat 28 jan", "14:00"); the native input sits on top, so a tap opens the
// phone's picker, and it shows itself while focused so a laptop can type into it
export function Pick({ type, label, value, onChange, min }: Props) {
  return (
    <label className={`pick ${type}`} data-empty={value ? undefined : ''}>
      <span className="pick-text" aria-hidden>{value ? shown(type, value) : type}</span>
      <input type={type} aria-label={label} value={value} min={min} onChange={(e) => onChange(e.target.value)}
        onClick={(e) => { try { e.currentTarget.showPicker() } catch { /* not every browser can */ } }} />
    </label>
  )
}
