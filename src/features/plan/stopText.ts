import type { Stop } from '../../lib/types'
import { nights } from '../../lib/dates'

const routed = (s: Stop) => s.kind === 'journey' && !!s.origin?.name && !!s.destination?.name

export function stopTitle(s: Stop): string {
  if (routed(s)) return `${s.origin!.name} to ${s.destination!.name}`
  return s.title || (s.kind === 'journey' ? s.mode ?? 'journey' : s.place?.name ?? '')
}

export function stopSub(s: Stop): string {
  if (s.kind === 'journey') {
    const times = s.time ? (s.end_time ? `${s.time}–${s.end_time}` : s.time) : ''
    return [s.mode, routed(s) ? s.title : '', times].filter(Boolean).join(' · ')
  }
  if (s.kind === 'stay') {
    const n = nights(s.day, s.end_date)
    return [s.time, n ? `${n} ${n === 1 ? 'night' : 'nights'}` : ''].filter(Boolean).join(' · ')
  }
  if (s.kind === 'note') return (s.notes ?? '').split('\n')[0]
  // the time has its own column in a day
  return [s.category, s.place?.city || s.place?.address].filter(Boolean).join(' · ')
}
