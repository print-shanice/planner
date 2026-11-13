import type { Mode, Stop } from './types'

// what a typed line most likely is, from its words alone. a guess, and it can be wrong ("line friends store"
// is a shop), so the icon beside every line changes it in one click
// by road: the ride apps and cars. these have no mode of their own (the database knows flight, train, bus, ferry),
// so a journey with no mode reads as a car
const BY_ROAD = /\b(grab|taxi|cab|uber|didi|lyft|bolt|gojek|car|drive)\b/i
const GETTING_AROUND = /\b(bus|train|line|metro|subway|shinkansen|ferry|express|tram)\b/i
const SHOPPY = /\b(store|shop|cafe|café|bar|restaurant|museum|bakery|house|building)\b/i

// how you get around, in the order the form and the card offer them; a car is no mode at all (null)
export const MODES: (Mode | null)[] = ['flight', 'train', 'bus', 'ferry', null]
export const modeWord = (m: Mode | null): string => m ?? 'car'
export const modeIcon = (m: Mode | null): string => (m === 'flight' ? 'plane' : m ?? 'car')

export function guessKind(text: string): { kind: 'place' | 'journey' | 'note'; mode: Mode | null } {
  const t = text.trim()
  if (/^walk\b/i.test(t)) return { kind: 'note', mode: null }
  if ((!GETTING_AROUND.test(t) && !BY_ROAD.test(t)) || SHOPPY.test(t)) return { kind: 'place', mode: null }
  if (/\bbus\b/i.test(t)) return { kind: 'journey', mode: 'bus' }
  if (/\bferry\b/i.test(t)) return { kind: 'journey', mode: 'ferry' }
  if (BY_ROAD.test(t)) return { kind: 'journey', mode: null }
  return { kind: 'journey', mode: 'train' }
}

// the fields that make a line something else. getting around takes its mode from its words
// (a grab is a car: no mode); words that say nothing make it a train
export function kindChange(s: Pick<Stop, 'id' | 'title'>, k: 'place' | 'journey' | 'note'): Partial<Stop> & { id: string } {
  if (k === 'place') return { id: s.id, kind: 'place', mode: null }
  if (k === 'note') return { id: s.id, kind: 'note', place: null, mode: null }
  const g = guessKind(s.title)
  return { id: s.id, kind: 'journey', mode: g.kind === 'journey' ? g.mode : 'train', place: null }
}
