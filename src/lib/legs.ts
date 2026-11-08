import type { Place, Stop } from './types'
import type { DayEntry } from './dates'
import { hasPoint, tooClose } from './walk'

export type Located = Place & { lat: number; lng: number }
export type Leg = { from: Stop; fromKind: DayEntry['kind']; to: Stop; a: Located; b: Located; evening: boolean }

// where you are when this row starts / ends (a journey moves you)
export const placeIn = (s: Stop): Place | null => (s.kind === 'journey' ? s.origin : s.place)
export const placeOut = (s: Stop): Place | null => (s.kind === 'journey' ? s.destination : s.place)

const isBed = (e: DayEntry) => e.kind === 'checkin' || e.kind === 'staying'

export function tonightsBed(entries: DayEntry[]): Stop | null {
  return entries.find(isBed)?.stop ?? null
}

export function mapBed(entries: DayEntry[]): Stop | null {
  return tonightsBed(entries) ?? entries.find((e) => e.kind === 'checkout')?.stop ?? null
}

// the walk from each located entry to the next (unlocated lines are jumped over),
// plus one back to tonight's bed when the day doesn't end there
export function dayLegs(entries: DayEntry[]): Leg[] {
  const legs: Leg[] = []
  let prev: { e: DayEntry; out: Located } | null = null
  for (const e of entries) {
    if (e.kind === 'sidetrip' || !e.stop) continue
    const here = placeIn(e.stop)
    if (hasPoint(here)) {
      if (prev && !tooClose(prev.out, here)) {
        legs.push({ from: prev.e.stop!, fromKind: prev.e.kind, to: e.stop, a: prev.out, b: here, evening: false })
      }
      const out = placeOut(e.stop)
      if (hasPoint(out)) prev = { e, out }
    } else {
      // an entry that only leaves from somewhere (a journey with just a destination) still moves you
      const out = placeOut(e.stop)
      if (hasPoint(out)) prev = { e, out }
    }
  }
  const bed = tonightsBed(entries)
  const bedAt = bed ? placeIn(bed) : null
  if (bed && hasPoint(bedAt) && prev && prev.e.stop!.id !== bed.id && !tooClose(prev.out, bedAt)) {
    legs.push({ from: prev.e.stop!, fromKind: prev.e.kind, to: bed, a: prev.out, b: bedAt, evening: true })
  }
  return legs
}

export function nextFrom(stopId: string, legs: Leg[]): Leg | null {
  return legs.find((l) => l.from.id === stopId) ?? null
}
