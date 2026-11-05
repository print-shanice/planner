import type { Place } from './types'

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
    if (p.osm_type && p.osm_id != null) place.osm_id = `${p.osm_type}${p.osm_id}`
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

export async function searchPlaces(q: string, near?: { lat: number; lng: number }): Promise<Place[]> {
  let url = `${PHOTON}/api?q=${encodeURIComponent(q.trim())}&limit=6&lang=en`
  if (near) url += `&lat=${near.lat}&lon=${near.lng}`
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
