import { normal } from './itinerary'
import { wikiMatch } from './wiki'
import { safeUrl } from './embed'

// a place's photo from openverse (wordpress's free search over open licence photos, mostly flickr), for the cafés,
// restaurants and shops wikipedia has no page for. no key, no account: 20 searches a minute and 200 a day per phone,
// so each place is remembered. it searches words, not places, so a photo is only taken when its title plainly names the
// place (the name with its city first, then the name alone); a chain may still show another branch
export type OpenPhoto = { src: string; page: string; source: string }

const API = 'https://api.openverse.org/v1/images/'

type Result = { title?: string | null; thumbnail?: string | null; foreign_landing_url?: string | null; source?: string | null }

async function search(q: string): Promise<Result[]> {
  const res = await fetch(`${API}?${new URLSearchParams({ q, page_size: '20' })}`)
  if (!res.ok) throw new Error(`openverse ${res.status}`)
  return (await res.json())?.results ?? []
}

export async function openversePhoto(place: { name: string; city?: string | null }): Promise<OpenPhoto | null> {
  const name = place.name?.trim()
  if (!name) return null
  const city = place.city?.trim()
  const asks = city && !normal(name).includes(normal(city)) ? [`${name} ${city}`, name] : [name]
  for (const q of asks) {
    const hit = (await search(q)).find((r) => r.title && r.thumbnail && safeUrl(r.foreign_landing_url) && wikiMatch(name, r.title))
    if (hit) return { src: hit.thumbnail!, page: hit.foreign_landing_url!, source: (hit.source || 'openverse').toLowerCase().replace(/_/g, ' ') }
  }
  return null
}
