import { useQuery } from '@tanstack/react-query'
import { addDays, daysBetween } from './dates'

// how warm it'll be where a trip goes, from open-meteo (free, no key, no account).
// a trip inside the forecast's reach gets the forecast for its days; one further off gets what those days
// were like the last three years, said as "usually". past trips, undated trips and long ones (whose weeks span seasons) get nothing

export type Unit = 'C' | 'F'
export type Temps = { hi: number; lo: number; kind: 'forecast' | 'usual'; unit: Unit }
export type WeatherAsk =
  | { kind: 'forecast'; from: string; to: string }
  | { kind: 'usual'; spans: { from: string; to: string }[] }

// the forecast reaches about 16 days ahead; stay a day short of its edge
const REACH = 15
// longer than this and one average says little
const LONGEST = 31

export function weatherAsk(start: string | null, end: string | null, today: string): WeatherAsk | null {
  if (!start) return null
  const last = end && end >= start ? end : start
  if (last < today || daysBetween(start, last) + 1 > LONGEST) return null
  const edge = addDays(today, REACH)
  if (start <= edge) return { kind: 'forecast', from: start < today ? today : start, to: last > edge ? edge : last }
  return { kind: 'usual', spans: [1, 2, 3].map((n) => ({ from: yearsBack(start, n), to: yearsBack(last, n) })) }
}

// the same day n years earlier; 29 february becomes the 28th
export function yearsBack(d: string, n: number): string {
  const y = Number(d.slice(0, 4)) - n
  const md = d.slice(5) === '02-29' ? '02-28' : d.slice(5)
  return `${y}-${md}`
}

const round2 = (x: number) => Math.round(x * 100) / 100

export function weatherUrl(kind: 'forecast' | 'archive', at: { lat: number; lng: number }, from: string, to: string, unit: Unit): string {
  const host = kind === 'forecast' ? 'https://api.open-meteo.com/v1/forecast' : 'https://archive-api.open-meteo.com/v1/archive'
  const q = new URLSearchParams({
    latitude: String(round2(at.lat)), longitude: String(round2(at.lng)),
    daily: 'temperature_2m_max,temperature_2m_min', timezone: 'auto', start_date: from, end_date: to,
    ...(unit === 'F' ? { temperature_unit: 'fahrenheit' } : {}),
  })
  return `${host}?${q}`
}

type Daily = { daily?: { temperature_2m_max?: (number | null)[]; temperature_2m_min?: (number | null)[] } }

// the average high and low over every day answered
export function averageOf(answers: Daily[]): { hi: number; lo: number } | null {
  const his = answers.flatMap((a) => a.daily?.temperature_2m_max ?? []).filter((x): x is number => typeof x === 'number')
  const los = answers.flatMap((a) => a.daily?.temperature_2m_min ?? []).filter((x): x is number => typeof x === 'number')
  if (!his.length || !los.length) return null
  const mean = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) / xs.length)
  return { hi: mean(his), lo: mean(los) }
}

// fahrenheit where people read it: the us and a few others
export function unitHere(): Unit {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region
    return region && ['US', 'LR', 'MM', 'BS', 'BZ', 'KY', 'PW'].includes(region) ? 'F' : 'C'
  } catch { return 'C' }
}

// a forecast is good for a few hours; what a place is usually like doesn't change
const KEEP = { forecast: 6 * 3_600_000, usual: 30 * 86_400_000 }

export async function fetchTemps(at: { lat: number; lng: number }, ask: WeatherAsk, unit: Unit): Promise<Temps | null> {
  const spans = ask.kind === 'forecast' ? [{ from: ask.from, to: ask.to }] : ask.spans
  const key = `weather:${round2(at.lat)},${round2(at.lng)}:${ask.kind}:${spans.map((s) => `${s.from}_${s.to}`).join(',')}:${unit}`
  let cached: { at: number; value: Temps | null } | null = null
  try { cached = JSON.parse(localStorage.getItem(key) ?? 'null') } catch { /* unreadable: ask again */ }
  if (cached && Date.now() - cached.at < KEEP[ask.kind]) return cached.value
  try {
    const answers = await Promise.all(spans.map(async (s) => {
      const res = await fetch(weatherUrl(ask.kind === 'forecast' ? 'forecast' : 'archive', at, s.from, s.to, unit))
      if (!res.ok) throw new Error(`weather ${res.status}`)
      return (await res.json()) as Daily
    }))
    const avg = averageOf(answers)
    const value = avg ? { ...avg, kind: ask.kind, unit } : null
    try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), value })) } catch { /* storage full */ }
    return value
  } catch (e) {
    if (cached) return cached.value
    throw e
  }
}

export function useTemps(at: { lat: number; lng: number } | null, ask: WeatherAsk | null) {
  const unit = unitHere()
  return useQuery({
    queryKey: ['weather', at?.lat, at?.lng, ask, unit],
    queryFn: () => fetchTemps(at!, ask!, unit),
    enabled: !!at && !!ask,
    staleTime: ask?.kind === 'usual' ? KEEP.usual : KEEP.forecast,
    retry: 0,
  })
}

// "9° / 3°", or "usually 9° / 3°" when it's what those days have been like, not a forecast
export function tempWords(t: Temps): string {
  return `${t.kind === 'usual' ? 'usually ' : ''}${t.hi}° / ${t.lo}°`
}
