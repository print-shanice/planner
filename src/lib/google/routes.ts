import type { Place } from '../types'
import { lib } from './loader'

type Pt = Pick<Place, 'lat' | 'lng'> & { lat: number; lng: number }
export type Walk = { seconds: number; meters: number; path: { lat: number; lng: number }[] }

const r5 = (x: number) => x.toFixed(5)
export const legKey = (a: Pt, b: Pt) => `${r5(a.lat)},${r5(a.lng)};${r5(b.lat)},${r5(b.lng)}`
const same = (a: Pt, b: Pt) => r5(a.lat) === r5(b.lat) && r5(a.lng) === r5(b.lng)

// up to ten stops between the ends is google's cheaper (essentials) route request
const MAX_POINTS = 12

// legs that follow on from each other become one request; a journey (or a gap) starts a new one
export function chainsOf<P extends Pt>(legs: { a: P; b: P }[]): P[][] {
  const out: P[][] = []
  for (const l of legs) {
    const last = out[out.length - 1]
    if (last && same(last[last.length - 1], l.a) && last.length < MAX_POINTS) last.push(l.b)
    else out.push([l.a, l.b])
  }
  return out
}

// answers for this visit only: google's route results aren't kept on the device
const cache = new Map<string, Walk | null>()
const asking = new Map<string, Promise<void>>()

export const cachedWalk = (a: Pt, b: Pt): Walk | null | undefined => cache.get(legKey(a, b))

type RoutesLib = { Route: { computeRoutes(r: Record<string, unknown>): Promise<{ routes?: { legs?: { durationMillis?: number | null; distanceMeters?: number; path?: { lat(): number; lng(): number }[] }[] }[] }> } }

async function ask(chain: Pt[]): Promise<void> {
  const { Route } = await lib<RoutesLib>('routes')
  const ll = (p: Pt) => ({ lat: p.lat, lng: p.lng })
  try {
    const { routes } = await Route.computeRoutes({
      origin: ll(chain[0]), destination: ll(chain[chain.length - 1]), intermediates: chain.slice(1, -1).map(ll),
      travelMode: 'WALKING', fields: ['legs', 'path'],
    })
    const legs = routes?.[0]?.legs ?? []
    chain.slice(1).forEach((b, i) => {
      const l = legs[i]
      cache.set(legKey(chain[i], b), l && l.durationMillis != null
        ? { seconds: Math.round(l.durationMillis / 1000), meters: l.distanceMeters ?? 0, path: (l.path ?? []).map((p) => ({ lat: p.lat(), lng: p.lng() })) }
        : null)
    })
  } catch {
    // a failed request is remembered as "no route" for this visit, so it isn't asked again and again
    chain.slice(1).forEach((b, i) => cache.set(legKey(chain[i], b), null))
  }
}

// one request per chain not already known; resolves when every leg has an answer (or none)
export async function walkLegs(legs: { a: Pt; b: Pt }[]): Promise<void> {
  const todo = legs.filter((l) => !cache.has(legKey(l.a, l.b)))
  await Promise.all(chainsOf(todo).map((chain) => {
    const k = chain.map((p) => `${r5(p.lat)},${r5(p.lng)}`).join('|')
    let p = asking.get(k)
    if (!p) { p = ask(chain).finally(() => asking.delete(k)); asking.set(k, p) }
    return p
  }))
}

export function forgetWalks(): void { cache.clear() }

export function walkWords(w: Walk | null | undefined): string | null {
  if (!w || w.seconds > 7200) return null
  const min = Math.max(1, Math.round(w.seconds / 60))
  if (!w.meters) return `${min} min walk`
  const dist = w.meters >= 1000 ? `${(w.meters / 1000).toFixed(1)} km` : `${Math.round(w.meters / 10) * 10} m`
  return `${min} min walk · ${dist}`
}
