import { useQueries } from '@tanstack/react-query'
import type { Stop, Trip } from './types'
import { ownerOn } from './agenda'
import { descendants } from './countries'

// public holidays where a trip goes, from nager.date (free, no key, no account): one request per country per year,
// kept on the device a month. only nationwide public holidays: regional ones and observances would mislead

export type Holiday = { date: string; name: string; local: string; country: string }

const KEEP = 30 * 86_400_000

export const holidaysUrl = (country: string, year: number) => `https://date.nager.at/api/v3/PublicHolidays/${year}/${country.toUpperCase()}`

type Raw = { date: string; name: string; localName: string; global?: boolean; types?: string[] }

export function readHolidays(raw: Raw[], country: string): Holiday[] {
  return raw
    .filter((h) => h.global !== false && (!h.types || h.types.includes('Public')))
    .map((h) => ({ date: h.date, name: h.name, local: h.localName, country: country.toUpperCase() }))
}

export async function fetchHolidays(country: string, year: number): Promise<Holiday[]> {
  const key = `holidays:${country.toUpperCase()}:${year}`
  let kept: { at: number; value: Holiday[] } | null = null
  try { kept = JSON.parse(localStorage.getItem(key) ?? 'null') } catch { /* unreadable: ask again */ }
  if (kept && Date.now() - kept.at < KEEP) return kept.value
  try {
    const res = await fetch(holidaysUrl(country, year))
    // a country the service doesn't know answers 404: it simply has none to show
    const value = res.status === 404 || res.status === 204 ? [] : res.ok ? readHolidays(await res.json(), country) : null
    if (!value) throw new Error(`holidays ${res.status}`)
    try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), value })) } catch { /* storage full */ }
    return value
  } catch (e) {
    if (kept) return kept.value
    throw e
  }
}

const yearsBetween = (from: string, to: string) => {
  const out: number[] = []
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) out.push(y)
  return out
}

// every holiday in the given countries and years, by date
export function useHolidays(countries: string[], from: string | null, to: string | null): Map<string, Holiday[]> {
  const pairs = from && to ? [...new Set(countries.map((c) => c.toUpperCase()))].slice(0, 12).flatMap((c) => yearsBetween(from, to).slice(0, 3).map((y) => [c, y] as const)) : []
  return useQueries({
    queries: pairs.map(([c, y]) => ({ queryKey: ['holidays', c, y], queryFn: () => fetchHolidays(c, y), staleTime: KEEP, retry: 0 })),
    combine: (results) => {
      const byDate = new Map<string, Holiday[]>()
      for (const r of results) for (const h of r.data ?? []) byDate.set(h.date, [...(byDate.get(h.date) ?? []), h])
      return byDate
    },
  })
}

// the countries you're in on a day: where the trip that owns the day is based, and wherever that day's plans are
export function countriesOn(trip: Trip, trips: Trip[], stops: Stop[], date: string, fallback: (t: Trip) => string[]): string[] {
  const owner = ownerOn(trip, trips, date)
  const family = new Set(descendants(trip.id, trips))
  const home = owner.base?.country ?? fallback(owner)[0]
  const there = stops.filter((s) => family.has(s.trip_id) && s.day === date).flatMap((s) => [s.place?.country, s.destination?.country])
  return [...new Set([home, ...there].filter((c): c is string => !!c && /^[a-z]{2}$/i.test(c)).map((c) => c.toUpperCase()))]
}

// that day's holidays in the countries you're in, one per name (easter in two countries is one line with both)
export function holidaysOn(byDate: Map<string, Holiday[]>, date: string, countries: string[]): Holiday[] {
  const here = new Set(countries)
  return (byDate.get(date) ?? []).filter((h) => here.has(h.country))
}
