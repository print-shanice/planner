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

// one of google's times ("9:00 am", "1:00" before a "pm") in the plan's 24-hour form
function clock(t: string, half: string | undefined): string | null {
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(t)
  const ap = m?.[3] ?? half
  if (!m || !ap) return null
  const h = (Number(m[1]) % 12) + (ap === 'pm' ? 12 : 0)
  if (h > 23) return null
  return `${String(h).padStart(2, '0')}:${m[2] ?? '00'}`
}

// "8:30 am – 12:00 pm, 1:00 – 5:30 pm" → "08:30–12:00, 13:00–17:30"; words it can't read stay as they are
function hours24(words: string): string {
  const ranges = words.split(/\s*,\s*/).map((r) => {
    const ends = r.split(/\s*[–-]\s*/)
    if (ends.length !== 2) return null
    const end = /(am|pm)$/.exec(ends[1])?.[1]
    const a = clock(ends[0], end), b = clock(ends[1], undefined)
    return a && b ? `${a}–${b}` : null
  })
  return ranges.every(Boolean) ? ranges.join(', ') : words
}

// the hours on the plan's day (else today), in the plan's time: "sat 10:00–14:00"
export function hoursOn(weekdays: string[] | null | undefined, day: string | null, today = new Date().toISOString().slice(0, 10)): string | null {
  if (!weekdays?.length) return null
  const d = day || today
  const date = new Date(`${d}T12:00:00Z`)
  if (!Number.isFinite(date.getTime())) return null
  const i = (date.getUTCDay() + 6) % 7 // google's week starts on monday
  const line = weekdays[i]
  if (!line) return null
  // google puts thin and narrow spaces around its times
  const words = line.replace(/^[^:]+:\s*/, '').replace(/\s+/g, ' ').toLowerCase().trim()
  return words ? `${DAYS[i]} ${hours24(words)}` : null
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
