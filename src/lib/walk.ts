import type { Place } from './types'

const ROUTER = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot'
const r5 = (x: number) => Number(x.toFixed(5))

export function hasPoint(p: Place | null | undefined): p is Place & { lat: number; lng: number } {
  return !!p && typeof p.lat === 'number' && typeof p.lng === 'number'
}

// two points this close are one place (an airport and its station's platform), not a walk
export function tooClose(a: Place, b: Place): boolean {
  if (!hasPoint(a) || !hasPoint(b)) return false
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h)) < 150
}

export function walkKey(a: Place, b: Place): string | null {
  if (!hasPoint(a) || !hasPoint(b)) return null
  return `walk:${r5(a.lat)},${r5(a.lng)};${r5(b.lat)},${r5(b.lng)}`
}

export async function walkSeconds(a: Place, b: Place): Promise<number | null> {
  const key = walkKey(a, b)
  if (!key || !hasPoint(a) || !hasPoint(b)) return null
  try {
    const hit = localStorage.getItem(key)
    if (hit != null) return Number(hit)
  } catch { /* storage unavailable */ }
  try {
    const r = await fetch(`${ROUTER}/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false`)
    if (!r.ok) return null
    const j = (await r.json()) as { routes?: { duration?: number }[] }
    const sec = j.routes?.[0]?.duration
    if (typeof sec !== 'number') return null
    try { localStorage.setItem(key, String(sec)) } catch { /* full */ }
    return sec
  } catch {
    return null
  }
}
