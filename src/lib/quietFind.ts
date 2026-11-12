import type { Place } from './types'
import { googleConfigured } from './google/config'
import { PlaceSession } from './google/places'
import { searchSpots } from './photon'
import { distanceKm, pickGuess } from './guess'
import { normal } from './itinerary'
import { hasPoint } from './walk'
import { todayISO } from './dates'

type Point = { lat: number; lng: number }

// a day trip out of town still counts (kamakura from a tokyo bed); the same name in another country doesn't
const KM = 100

const words = (s: string) => normal(s).replace(/['’]/g, '').split(/[^\p{L}\p{N}]+/u).filter(Boolean)

// is this search result plainly what was typed? every word typed is in its name or where it is, and most of its
// name was typed ("kyoto obuya" → obuya, kyoto); or its whole name is inside what was typed ("cut hair at assort" → assort)
export function plainMatch(typed: string, name: string, where = ''): boolean {
  const t = words(typed), n = words(name), around = new Set([...n, ...words(where)])
  if (!t.length || !n.length) return false
  const typedSet = new Set(t)
  const allTyped = t.every((w) => around.has(w))
  const mostOfName = n.filter((w) => typedSet.has(w)).length * 2 >= n.length
  const nameInside = n.every((w) => typedSet.has(w)) && n.join('').length >= 4
  return (allTyped && mostOfName) || nameInside
}

// a typed name's place, found without asking: google when it's set up (the first suggestion that plainly matches,
// one details call), else openstreetmap spots. near where that day happens, or nothing
export async function quietFind(typed: string, near: Point | null): Promise<Place | null> {
  const q = typed.trim()
  if (!q || !near) return null
  if (!googleConfigured()) return pickGuess(q, await searchSpots(q, near), near)
  const session = new PlaceSession()
  const hit = (await session.suggest(q, near)).find((s) => plainMatch(q, s.name, s.sub))
  if (!hit) return null
  const p = await session.pick(hit, todayISO())
  return hasPoint(p) && distanceKm(near, p) <= KM ? p : null
}
