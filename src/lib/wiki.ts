import { normal } from './itinerary'
import { plainMatch } from './quietFind'
import { distanceKm } from './geo'

// a photo of a place from english wikipedia, for when google has none: the nearest page within a few hundred
// metres that is plainly the place (sights, museums, temples, famous cafés; most small shops have no page).
// free and keyless; the photos are free ones, credited with a link to the photo's own page
export type WikiPhoto = { src: string; page: string }

const API = 'https://en.wikipedia.org/w/api.php'
const RADIUS = 500
const WIDTH = 800

const words = (s: string) => normal(s).replace(/['’]/g, '').split(/[^\p{L}\p{N}]+/u).filter(Boolean)
const SMALL = new Set(['the', 'le', 'la', 'les', 'l', 'el', 'il', 'de', 'du', 'des', 'der', 'die', 'das', 'het', 'a'])

// the page is the place: the names plainly match, and the page carries the place's first real word
// (so "starbucks shibuya" doesn't take shibuya's page, nor "louvre museum" the carrousel du louvre's)
export function wikiMatch(name: string, title: string): boolean {
  const first = words(name).find((w) => !SMALL.has(w))
  if (!first || !words(title).includes(first)) return false
  return plainMatch(name, title)
}

type Page = { title: string; coordinates?: { lat: number; lon: number }[]; pageimage?: string; thumbnail?: { source: string } }

export async function wikiPhoto(place: { name: string; lat?: number | null; lng?: number | null }): Promise<WikiPhoto | null> {
  const { name, lat, lng } = place
  if (!name?.trim() || typeof lat !== 'number' || typeof lng !== 'number') return null
  const q = new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', origin: '*',
    generator: 'geosearch', ggscoord: `${lat}|${lng}`, ggsradius: String(RADIUS), ggslimit: '50',
    prop: 'pageimages|coordinates', piprop: 'thumbnail|name', pithumbsize: String(WIDTH),
  })
  const res = await fetch(`${API}?${q}`)
  if (!res.ok) throw new Error(`wikipedia ${res.status}`)
  const pages: Page[] = (await res.json())?.query?.pages ?? []
  const far = (p: Page) => (p.coordinates?.[0] ? distanceKm({ lat, lng }, { lat: p.coordinates[0].lat, lng: p.coordinates[0].lon }) : Infinity)
  const hit = pages.filter((p) => wikiMatch(name, p.title)).sort((a, b) => far(a) - far(b))[0]
  if (!hit?.thumbnail?.source || !hit.pageimage) return null
  return { src: hit.thumbnail.source, page: `https://en.wikipedia.org/wiki/File:${encodeURIComponent(hit.pageimage)}` }
}
