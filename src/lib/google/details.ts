import { useQuery } from '@tanstack/react-query'
import { lib } from './loader'
import { googleConfigured } from './config'
import { useOnline } from '../offline'

// what google says about a place, as the card shows it: one request per place, kept on the device for 30 days
// (google's limit on keeping its answers). the fields stop at the "enterprise" price: no google reviews,
// no atmosphere ("editorial summary" and the like), which cost more and are asked for less kindly
export type Details = {
  rating: number | null
  ratings: number | null
  // what google calls it ("hotel", "coffee shop"), lowercased
  kind: string | null
  photo: string | null
  // opening hours, one line per weekday from monday, as google words them
  weekdays: string[] | null
  website: string | null
  maps: string | null
}

export const DETAIL_PLUS = ['rating', 'userRatingCount', 'primaryTypeDisplayName', 'photos', 'regularOpeningHours', 'websiteURI', 'googleMapsURI'] as const

type Photo = { getURI?: (o: { maxWidth?: number; maxHeight?: number }) => string }
type Fields = {
  rating?: number | null
  userRatingCount?: number | null
  primaryTypeDisplayName?: string | null
  photos?: Photo[] | null
  regularOpeningHours?: { weekdayDescriptions?: string[] | null } | null
  websiteURI?: string | null
  googleMapsURI?: string | null
}

const PHOTO_WIDTH = 800
// google lets its answers be kept this long
const KEEP = 30 * 24 * 60 * 60 * 1000

export function toDetails(f: Fields): Details {
  const photo = f.photos?.[0]?.getURI?.({ maxWidth: PHOTO_WIDTH }) ?? null
  const weekdays = f.regularOpeningHours?.weekdayDescriptions?.length ? f.regularOpeningHours.weekdayDescriptions : null
  return {
    rating: f.rating ? f.rating : null,
    ratings: f.userRatingCount ?? null,
    kind: f.primaryTypeDisplayName ? f.primaryTypeDisplayName.toLowerCase() : null,
    photo: photo || null,
    weekdays,
    website: f.websiteURI || null,
    maps: f.googleMapsURI || null,
  }
}

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

// the hours on the plan's day (else today): "sat · 10:00 am – 2:00 pm"
export function hoursOn(weekdays: string[] | null | undefined, day: string | null, today = new Date().toISOString().slice(0, 10)): string | null {
  if (!weekdays?.length) return null
  const d = day || today
  const date = new Date(`${d}T12:00:00Z`)
  if (!Number.isFinite(date.getTime())) return null
  const i = (date.getUTCDay() + 6) % 7 // google's week starts on monday
  const line = weekdays[i]
  if (!line) return null
  const words = line.replace(/^[^:]+:\s*/, '').toLowerCase().trim()
  return words ? `${DAYS[i]} · ${words}` : null
}

type PlacesLib = { Place: new (o: { id: string }) => { fetchFields(o: { fields: string[] }): Promise<{ place: Fields }> } }

export async function fetchDetails(gid: string): Promise<Details> {
  const places = await lib<PlacesLib>('places')
  const { place } = await new places.Place({ id: gid }).fetchFields({ fields: [...DETAIL_PLUS] })
  return toDetails(place)
}

// a place's details, asked for once it shows and then remembered for 30 days (also offline, from the saved copy)
export function useDetails(gid: string | null | undefined) {
  const online = useOnline()
  const enabled = !!gid && online && googleConfigured()
  const q = useQuery<Details>({
    queryKey: ['gplace', gid],
    queryFn: () => fetchDetails(gid!),
    enabled,
    staleTime: KEEP,
    retry: 0,
  })
  return { ...q, enabled }
}
