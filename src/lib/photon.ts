import type { Place } from './types'
import { fromOsm } from './categories'

export const PHOTON = 'https://photon.komoot.io'

type Props = Record<string, string | number | undefined>
const CITYISH = new Set(['city', 'town', 'village', 'hamlet'])

export function parsePhoton(json: unknown): Place[] {
  const feats = (json as { features?: unknown[] } | null)?.features
  if (!Array.isArray(feats)) return []
  const out: Place[] = []
  for (const f of feats as { geometry?: { coordinates?: number[] }; properties?: Props }[]) {
    const c = f?.geometry?.coordinates
    const p = f?.properties ?? {}
    if (!Array.isArray(c) || c.length < 2 || typeof c[0] !== 'number' || typeof c[1] !== 'number') continue
    const name = String(p.name ?? p.street ?? '').trim()
    if (!name) continue
    const isCity = CITYISH.has(String(p.type ?? '')) || CITYISH.has(String(p.osm_value ?? ''))
    const city = (p.city ?? p.town ?? p.village ?? (isCity ? name : undefined)) as string | undefined
    const street = [p.street, p.housenumber].filter(Boolean).join(' ')
    const parts = isCity ? [p.state] : [street, city !== name ? city : undefined]
    const address = parts.filter(Boolean).join(', ')
    const place: Place = { name, address, ...(city ? { city: String(city) } : {}), country: p.countrycode ? String(p.countrycode).toUpperCase() : undefined, lat: c[1], lng: c[0] }
    const area = String(p.district ?? p.locality ?? '').trim()
    if (area && area !== name && area !== city) place.area = area
    if (p.osm_type && p.osm_id != null) place.osm_id = `${p.osm_type}${p.osm_id}`
    const category = fromOsm(String(p.osm_key ?? ''), String(p.osm_value ?? ''))
    if (category) place.category = category
    if (!place.country) delete place.country
    out.push(place)
  }
  return out
}

async function getJson(url: string): Promise<unknown> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`photon ${r.status}`)
  return r.json()
}

// near a map view (with its zoom), results lean harder towards what's on screen
export async function searchPlaces(q: string, near?: { lat: number; lng: number; zoom?: number }): Promise<Place[]> {
  let url = `${PHOTON}/api?q=${encodeURIComponent(q.trim())}&limit=6&lang=en`
  if (near) url += `&lat=${near.lat}&lon=${near.lng}`
  if (near?.zoom != null) url += `&zoom=${Math.round(near.zoom)}&location_bias_scale=0.5`
  return parsePhoton(await getJson(url))
}

export async function reversePlace(lat: number, lng: number): Promise<Place | null> {
  try {
    const [p] = parsePhoton(await getJson(`${PHOTON}/reverse?lat=${lat}&lon=${lng}&lang=en`))
    return p ? { ...p, lat, lng } : null
  } catch {
    return null
  }
}

// specific places only (a cafe, a shop, a sight), never an area, a street or a station
const SPOTS = new Set(['amenity', 'shop', 'tourism', 'leisure', 'historic', 'craft', 'office', 'building'])

export function parseSpots(json: unknown): Place[] {
  const feats = (json as { features?: { properties?: Props }[] } | null)?.features
  if (!Array.isArray(feats)) return []
  return parsePhoton({ features: feats.filter((f) => SPOTS.has(String(f?.properties?.osm_key ?? ''))) })
}

export async function searchSpots(q: string, near: { lat: number; lng: number }): Promise<Place[]> {
  return parseSpots(await getJson(`${PHOTON}/api?q=${encodeURIComponent(q.trim())}&limit=8&lang=en&lat=${near.lat}&lon=${near.lng}`))
}
