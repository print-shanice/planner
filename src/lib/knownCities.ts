import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { distanceKm, type Point } from './geo'

// what counts as a city in the travels totals, so a suburb or a town a place's address happens to name
// (akiruno, akishima) is never counted as one. public/globe/known-cities.json is [name, lng, lat, big] rows:
// the cities the globe names (natural earth, cities.json; big when it names them by zoom 4) plus geonames'
// capitals of countries and their first regions (cities15000, PPLC and PPLA), which fills gaps like nara
export type KnownCity = { name: string; key: string; lat: number; lng: number; big: boolean }
export type KnownCities = Map<string, KnownCity[]>

// "Ōsaka", "osaka", "Taipei City", "Kyoto-shi" all read the same
export function cityKey(name: string): string {
  return name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[-\s]+(city|shi)$/, '').replace(/^city of\s+/, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

export type Row = [name: string, lng: number, lat: number, big: 0 | 1]

export function knownCities(rows: Row[]): KnownCities {
  const out: KnownCities = new Map()
  for (const row of Array.isArray(rows) ? rows : []) {
    // a copy saved on the device by an older version can be in another shape: skip what isn't a row
    if (!Array.isArray(row) || typeof row[0] !== 'string' || !Number.isFinite(row[1]) || !Number.isFinite(row[2])) continue
    const [n, lng, lat, big] = row
    const c = { name: n, key: cityKey(n), lat, lng, big: big === 1 }
    out.set(c.key, [...(out.get(c.key) ?? []), c])
  }
  return out
}

// a name only matches a city of that name nearby, so paris, texas is never paris
const SAME_CITY_KM = 60
// a place in one of a big city's wards (shibuya, taitō) counts as the city itself
const IN_BIG_CITY_KM = 20

export function realCity(name: string | null | undefined, at: { lat?: number | null; lng?: number | null }, known: KnownCities): string | null {
  const here = Number.isFinite(at.lat) && Number.isFinite(at.lng) ? (at as Point) : null
  const named = name?.trim() ? known.get(cityKey(name)) : undefined
  if (named?.length) {
    if (!here) return name!.trim()
    if (named.some((c) => distanceKm(here, c) <= SAME_CITY_KM)) return name!.trim()
  }
  if (!here) return null
  let best: { c: KnownCity; d: number } | null = null
  for (const list of known.values()) for (const c of list) {
    if (!c.big) continue
    const d = distanceKm(here, c)
    if (d <= IN_BIG_CITY_KM && (!best || d < best.d)) best = { c, d }
  }
  return best?.c.name ?? null
}

export function useKnownCities(): KnownCities | undefined {
  const q = useQuery({
    // the version in the key leaves behind copies saved in an older shape
    queryKey: ['known-cities', 2],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}globe/known-cities.json`)
      if (!res.ok) throw new Error(`cities ${res.status}`)
      return (await res.json()) as Row[]
    },
    staleTime: Infinity,
  })
  const rows = q.data
  return useMemo(() => (rows ? knownCities(rows) : undefined), [rows])
}
