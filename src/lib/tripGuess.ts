import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { Stop, Trip } from './types'
import { descendants, tripCountries } from './countries'
import { normal } from './itinerary'
import { PHOTON } from './photon'

// a trip with no place set (no base, nothing located in it) still gets its flags: its name is looked up once
// ("amsterdam", "madrid · lisbon") and the answer kept on this device. it only ever fills a gap on screen:
// nothing is saved to the trip, and a country the trip really has always wins

export type Guesses = Record<string, string[]>
const KEY = 'planner.tripcc'
const key = (name: string) => normal(name.trim())

// the places a name is made of: "madrid · lisbon" is two
export function nameParts(name: string): string[] {
  return name.toLowerCase().split(/\s*[·,&/+]\s*|\s+and\s+|\s+to\s+/).map((p) => p.trim()).filter((p) => p.length >= 3)
}

// what the search calls a result: a town or a region counts, a building, a street or a patch of land never does
const AREAS = new Set(['city', 'district', 'county', 'state', 'country'])

// the country of the first town, region or country with exactly that name (the search lists the best known first),
// else nothing: never a cafe or a street that shares a word
export function pickCountry(part: string, json: unknown): string | null {
  const feats = (json as { features?: { properties?: Record<string, unknown> }[] } | null)?.features
  if (!Array.isArray(feats)) return null
  const want = key(part)
  for (const f of feats) {
    const p = f?.properties ?? {}
    const cc = String(p.countrycode ?? '').toUpperCase()
    if (AREAS.has(String(p.type ?? '')) && key(String(p.name ?? '')) === want && /^[A-Z]{2}$/.test(cc)) return cc
  }
  return null
}

export function flagsFor(trip: Trip, trips: Trip[], stops: Stop[], guesses: Guesses): string[] {
  const out = tripCountries(trip, trips, stops)
  const byId = new Map(trips.map((t) => [t.id, t]))
  for (const id of new Set([trip.id, ...descendants(trip.id, trips)])) {
    const t = id === trip.id ? trip : byId.get(id)
    if (!t || tripCountries(t, [t], stops).length) continue
    for (const c of guesses[key(t.name)] ?? []) if (!out.includes(c)) out.push(c)
  }
  return out
}

// ---- the guesses kept on this device, shared by every screen ----
let cache: Guesses | null = null
const listeners = new Set<() => void>()
function read(): Guesses {
  if (cache) return cache
  try { cache = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Guesses } catch { cache = {} }
  if (!cache || typeof cache !== 'object') cache = {}
  return cache
}
function put(name: string, codes: string[]) {
  cache = { ...read(), [name]: codes }
  try { localStorage.setItem(KEY, JSON.stringify(cache)) } catch { /* private window: asked again next time */ }
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
const asking = new Set<string>()

export type Lookup = (part: string) => Promise<unknown>
// tests never reach for the network
const online: Lookup = (part) => import.meta.env.MODE === 'test'
  ? Promise.reject(new Error('no lookups in tests'))
  : fetch(`${PHOTON}/api?q=${encodeURIComponent(part)}&limit=6&lang=en`).then((r) => { if (!r.ok) throw new Error(`photon ${r.status}`); return r.json() })

async function guess(name: string, lookup: Lookup) {
  const k = key(name)
  if (!k || asking.has(k) || k in read()) return
  asking.add(k)
  try {
    const codes: string[] = []
    for (const part of nameParts(name)) {
      const c = pickCountry(part, await lookup(part))
      if (c && !codes.includes(c)) codes.push(c)
    }
    put(k, codes)
  } catch { /* offline or the search is down: try again another time */ } finally { asking.delete(k) }
}

// flagsOf(trip): its countries, with a guess from its name where it has none
export function useTripFlags(trips: Trip[], stops: Stop[], lookup: Lookup = online): (t: Trip) => string[] {
  const guesses = useSyncExternalStore(subscribe, read, read)
  const bare = useMemo(() => trips.filter((t) => !tripCountries(t, [t], stops).length).map((t) => t.name), [trips, stops])
  useEffect(() => { for (const name of bare) void guess(name, lookup) }, [bare.join('\n'), lookup]) // eslint-disable-line react-hooks/exhaustive-deps
  return useMemo(() => (t: Trip) => flagsFor(t, trips, stops, guesses), [trips, stops, guesses])
}

export function forgetGuesses() { cache = null; asking.clear() }
