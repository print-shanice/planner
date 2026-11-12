import type { DayEntry } from './dates'
import { hasPoint } from './walk'

// a number means a pin: only a line with a spot on the map is counted, top to bottom, the same in the plan and on the map.
// getting around (a bus, a train, a flight), a plain note, a place not found yet and a stay have no number
export function pinNumbers(entries: DayEntry[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const e of entries) {
    const s = e.stop
    if (e.kind !== 'stop' || !s || s.kind === 'journey' || s.kind === 'stay') continue
    if (hasPoint(s.place)) out.set(s.id, out.size + 1)
  }
  return out
}
