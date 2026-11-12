import type { Mode } from './types'

// what a typed line most likely is, from its words alone. a guess, and it can be wrong ("line friends store"
// is a shop), so the icon beside every line changes it in one click
// by road: the ride apps and cars. these have no mode of their own (the database knows flight, train, bus, ferry),
// so a journey with no mode reads as a car
const BY_ROAD = /\b(grab|taxi|cab|uber|didi|lyft|bolt|gojek|car|drive)\b/i
const GETTING_AROUND = /\b(bus|train|line|metro|subway|shinkansen|ferry|express|tram)\b/i
const SHOPPY = /\b(store|shop|cafe|café|bar|restaurant|museum|bakery|house|building)\b/i

export function guessKind(text: string): { kind: 'place' | 'journey' | 'note'; mode: Mode | null } {
  const t = text.trim()
  if (/^walk\b/i.test(t)) return { kind: 'note', mode: null }
  if ((!GETTING_AROUND.test(t) && !BY_ROAD.test(t)) || SHOPPY.test(t)) return { kind: 'place', mode: null }
  if (/\bbus\b/i.test(t)) return { kind: 'journey', mode: 'bus' }
  if (/\bferry\b/i.test(t)) return { kind: 'journey', mode: 'ferry' }
  if (BY_ROAD.test(t)) return { kind: 'journey', mode: null }
  return { kind: 'journey', mode: 'train' }
}
