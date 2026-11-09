import { useEffect, useState } from 'react'
import type { Place } from '../../lib/types'
import { googleConfigured } from '../../lib/google/config'
import { cachedWalk, legKey, walkLegs, type Walk } from '../../lib/google/routes'
import { walkSeconds } from '../../lib/walk'
import { useOnline } from '../../lib/offline'

type Pt = Place & { lat: number; lng: number }
export type WalkAnswer = Walk | null | undefined // undefined: still asking

// without google, openstreetmap's walking router gives the minutes (no distance or line)
const osrm = new Map<string, Walk | null>()

// the walks between a day's places, asked for only while `on` (the day is on screen),
// once per pair per visit; a reordered day asks only for its new pairs
export function useWalks(legs: { a: Pt; b: Pt }[], on = true): (a: Pt, b: Pt) => WalkAnswer {
  const online = useOnline()
  const [, bump] = useState(0)
  const key = legs.map((l) => legKey(l.a, l.b)).join('|')
  useEffect(() => {
    if (!on || !online || !legs.length) return
    let alive = true
    if (googleConfigured()) {
      walkLegs(legs).then(() => { if (alive) bump((n) => n + 1) }).catch(() => {})
    } else {
      for (const l of legs) {
        const k = legKey(l.a, l.b)
        if (osrm.has(k)) continue
        walkSeconds(l.a, l.b).then((sec) => {
          osrm.set(k, sec == null ? null : { seconds: sec, meters: 0, path: [] })
          if (alive) bump((n) => n + 1)
        })
      }
    }
    return () => { alive = false }
  }, [key, on, online]) // eslint-disable-line react-hooks/exhaustive-deps
  return (a, b) => {
    if (googleConfigured()) { const w = cachedWalk(a, b); return w !== undefined ? w : online ? undefined : null }
    const k = legKey(a, b)
    return osrm.has(k) ? osrm.get(k) : online ? undefined : null
  }
}
