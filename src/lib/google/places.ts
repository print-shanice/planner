import type { Place } from '../types'
import { fromGoogleTypes } from '../categories'
import { lib } from './loader'

// a suggestion as the search list shows it; the place itself is only fetched once one is picked
export type Suggestion = { id: string; name: string; sub: string; types: string[]; category?: string; raw?: unknown }

type Near = { lat: number; lng: number; zoom?: number } | null | undefined

// details stop at the essentials price: where it is, its address parts and its types.
// the name comes from the suggestion you picked, so no pro fields are ever asked for
export const DETAIL_FIELDS = ['location', 'formattedAddress', 'addressComponents', 'types'] as const

type Comp = { longText?: string | null; shortText?: string | null; types?: string[] }

export function toPlace(name: string, gid: string, f: { location?: { lat(): number; lng(): number } | null; formattedAddress?: string | null; addressComponents?: Comp[] | null; types?: string[] | null }, today: string): Place {
  const comps = f.addressComponents ?? []
  const of = (...t: string[]) => comps.find((c) => c.types?.some((x) => t.includes(x)))
  const city = of('locality', 'postal_town')?.longText ?? of('administrative_area_level_2')?.longText ?? undefined
  const area = of('sublocality_level_1', 'sublocality', 'neighborhood')?.longText ?? undefined
  const country = of('country')?.shortText?.toUpperCase() ?? undefined
  const lat = f.location?.lat() ?? null, lng = f.location?.lng() ?? null
  // the address without the name in front of it or the country at the end
  const address = (f.formattedAddress ?? '').split(',').map((x) => x.trim()).filter((x, i, all) => x && !(i === 0 && x.toLowerCase() === name.toLowerCase()) && !(i === all.length - 1 && all.length > 1 && /^[^\d]+$/.test(x) && comps.some((c) => c.types?.includes('country') && c.longText === x))).join(', ')
  const place: Place = { name, address, lat, lng, gid, at: today }
  if (city) place.city = city
  if (area && area !== city) place.area = area
  if (country) place.country = country
  const category = fromGoogleTypes(f.types)
  if (category) place.category = category
  return place
}

type PlacesLib = {
  AutocompleteSessionToken: new () => object
  AutocompleteSuggestion: { fetchAutocompleteSuggestions: (r: Record<string, unknown>) => Promise<{ suggestions: { placePrediction?: Prediction | null }[] }> }
  Place: new (o: { id: string }) => GPlace
}
type Text = { text: string } | null | undefined
type Prediction = { placeId: string; text?: Text; mainText?: Text; secondaryText?: Text; types?: string[]; toPlace(): GPlace }
type GPlace = { id?: string; displayName?: string | null; fetchFields(o: { fields: string[] }): Promise<{ place: GPlace }> } & Parameters<typeof toPlace>[2]

// one search session: suggestions while typing, closed by fetching the picked place's details
export class PlaceSession {
  private token: object | null = null

  async suggest(input: string, near?: Near): Promise<Suggestion[]> {
    const places = await lib<PlacesLib>('places')
    this.token ??= new places.AutocompleteSessionToken()
    const req: Record<string, unknown> = { input, sessionToken: this.token, language: 'en' }
    if (near) req.locationBias = { center: { lat: near.lat, lng: near.lng }, radius: near.zoom != null && near.zoom >= 12 ? 5000 : 30000 }
    const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions(req)
    return suggestions.flatMap((s) => {
      const p = s.placePrediction
      if (!p) return []
      const name = p.mainText?.text ?? p.text?.text ?? ''
      if (!name) return []
      const category = fromGoogleTypes(p.types) ?? undefined
      return [{ id: p.placeId, name, sub: p.secondaryText?.text ?? '', types: p.types ?? [], category, raw: p }]
    })
  }

  async pick(s: Suggestion, today: string): Promise<Place> {
    const places = await lib<PlacesLib>('places')
    const g = (s.raw as Prediction | undefined)?.toPlace() ?? new places.Place({ id: s.id })
    this.token = null // the next search is a new session
    const { place } = await g.fetchFields({ fields: [...DETAIL_FIELDS] })
    return toPlace(s.name, s.id, place, today)
  }
}

// the coordinates and address again, for a place saved more than 30 days ago (google's limit on keeping them)
export async function refetchPlace(p: Place, today: string): Promise<Place> {
  const places = await lib<PlacesLib>('places')
  const { place } = await new places.Place({ id: p.gid! }).fetchFields({ fields: [...DETAIL_FIELDS] })
  const fresh = toPlace(p.name, p.gid!, place, today)
  return { ...p, lat: fresh.lat, lng: fresh.lng, address: fresh.address, at: today }
}

// a tap on one of google's own map labels: it has no name until asked (a pro field, so only on a tap)
export async function placeFromMap(gid: string, today: string): Promise<Place> {
  const places = await lib<PlacesLib>('places')
  const { place } = await new places.Place({ id: gid }).fetchFields({ fields: ['displayName', ...DETAIL_FIELDS] })
  return toPlace(place.displayName ?? '', gid, place, today)
}

const DAY = 86_400_000
export function needsRefresh(p: Place | null | undefined, today: string): boolean {
  if (!p?.gid || !p.at) return false
  return Date.parse(`${today}T12:00:00Z`) - Date.parse(`${p.at}T12:00:00Z`) >= 30 * DAY
}
