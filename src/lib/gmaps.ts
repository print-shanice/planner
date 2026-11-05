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
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null
}
