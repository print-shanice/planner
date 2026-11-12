import type { Place } from './types'
import { searchPlaces } from './photon'
import { googleConfigured } from './google/config'
import { PlaceSession } from './google/places'
import { distanceKm, nearFirst } from './guess'
import { hasPoint } from './walk'
import { todayISO } from './dates'

type Point = { lat: number; lng: number }

// a day trip out of town still counts; the same name in another country doesn't
const KM = 100

// a name typed into the plan, found on the map: google when it's set up, else openstreetmap,
// leaning towards where that day happens. null when nothing close enough answers to it
export async function locate(name: string, near: Point | null): Promise<Place | null> {
  const q = name.trim()
  if (!q) return null
  let found: Place | null = null
  if (googleConfigured()) {
    const session = new PlaceSession()
    const [first] = await session.suggest(q, near)
    if (first) found = await session.pick(first, todayISO())
  } else {
    found = nearFirst(await searchPlaces(q, near ?? undefined), near).find(hasPoint) ?? null
  }
  if (!found || !hasPoint(found)) return null
  return !near || distanceKm(near, found) <= KM ? found : null
}
