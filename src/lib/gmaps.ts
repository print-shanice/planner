import type { Place, Stop } from './types'

function query(p: Place | null | undefined): string | null {
  if (!p) return null
  const words = [p.name, p.address].map((x) => (x ?? '').trim()).filter(Boolean)
  if (words.length) return words.join(', ')
  if (typeof p.lat === 'number' && typeof p.lng === 'number') return `${p.lat},${p.lng}`
  return null
}

export function gmapsUrl(s: Stop): string | null {
  if (s.kind === 'journey') {
    const a = query(s.origin), b = query(s.destination)
    if (a && b) {
      const mode = s.mode === 'train' || s.mode === 'bus' || s.mode === 'ferry' ? 'transit' : 'walking'
      return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(a)}&destination=${encodeURIComponent(b)}&travelmode=${mode}`
    }
    const one = a ?? b
    return one ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(one)}` : null
  }
  const q = query(s.place)
  if (!q) return null
  // google's own place, when it came from google, so the right business opens
  const id = s.place?.gid ? `&query_place_id=${encodeURIComponent(s.place.gid)}` : ''
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}${id}`
}

// Omitting origin lets Google Maps use the device's current location.
export function directionsUrl(to: Place | null | undefined): string | null {
  const destination = query(to)
  if (!destination) return null
  const id = to?.gid ? `&destination_place_id=${encodeURIComponent(to.gid)}` : ''
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}${id}`
}
