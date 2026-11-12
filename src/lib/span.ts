import type { Stop } from './types'
import { daysBetween } from './dates'

const MIN = 60_000
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

function words(m: number): string {
  const h = Math.floor(m / 60), r = m % 60
  if (!h) return `${r} min`
  return r ? `${h} h ${r} min` : `${h} h`
}

// how long a journey takes ("1 h 24 min"): a looked-up flight by its own clocks (time zones counted), else its times
export function journeyLength(s: Stop): string | null {
  const f = s.flight
  if (f) {
    const m = (Date.parse(f.arr.scheduled.replace(' ', 'T')) - Date.parse(f.dep.scheduled.replace(' ', 'T'))) / MIN
    if (Number.isFinite(m) && m > 0) return words(Math.round(m))
  }
  if (!s.day || !s.time || !s.end_time) return null
  const days = s.end_date ? daysBetween(s.day, s.end_date) : 0
  const m = days * 24 * 60 + minutes(s.end_time) - minutes(s.time)
  return m > 0 ? words(m) : null
}
