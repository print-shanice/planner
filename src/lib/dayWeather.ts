import { useQueries } from '@tanstack/react-query'
import { addDays } from './dates'
import type { Point } from './geo'
import { unitHere, weatherUrl, yearsBack, type Unit } from './weather'

// each day's low and high where that day happens, from open-meteo (free, no key).
// days the forecast reaches get the forecast, past days what they were, days further off what those dates
// have usually been like (the last three years, a few days either side so one odd day doesn't decide it)

export type DayTemp = { lo: number; hi: number }
export type DayKind = 'was' | 'forecast' | 'usual'
export type DayAsk = { kind: DayKind; at: Point; from: string; to: string }
export type DayShown = DayTemp & { kind: DayKind }

// the forecast reaches about 16 days ahead, and serves the last few weeks too
const AHEAD = 15
const BEHIND = 30
// either side of a far-off date when working out what it's usually like
const AROUND = 3
const ORDER: DayKind[] = ['was', 'forecast', 'usual']

export function dayKind(date: string, today: string): DayKind {
  if (date < addDays(today, -BEHIND)) return 'was'
  return date <= addDays(today, AHEAD) ? 'forecast' : 'usual'
}

// about 10 km: close enough for the weather, and no exact spot leaves the device
const coarse = (p: Point): Point => ({ lat: Math.round(p.lat * 10) / 10, lng: Math.round(p.lng * 10) / 10 })

// one ask per kind and place, spanning that place's days
export function dayAsks(days: { date: string; at: Point }[], today: string): DayAsk[] {
  const asks = new Map<string, DayAsk>()
  for (const d of days) {
    const at = coarse(d.at)
    const kind = dayKind(d.date, today)
    const key = `${kind}:${at.lat},${at.lng}`
    const a = asks.get(key)
    if (!a) asks.set(key, { kind, at, from: d.date, to: d.date })
    else { if (d.date < a.from) a.from = d.date; if (d.date > a.to) a.to = d.date }
  }
  return [...asks.values()].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind))
}

type Daily = { daily?: { time?: string[]; temperature_2m_max?: (number | null)[]; temperature_2m_min?: (number | null)[] } }

function byDate(a: Daily): Map<string, { hi: number; lo: number }> {
  const out = new Map<string, { hi: number; lo: number }>()
  const d = a.daily
  d?.time?.forEach((t, i) => {
    const hi = d.temperature_2m_max?.[i], lo = d.temperature_2m_min?.[i]
    if (typeof hi === 'number' && typeof lo === 'number') out.set(t, { hi, lo })
  })
  return out
}

const mean = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) / xs.length)

// what each date has usually been like: years[n] is n + 1 years back
export function usualFrom(dates: string[], years: Daily[]): Record<string, DayTemp> {
  const seen = years.map(byDate)
  const out: Record<string, DayTemp> = {}
  for (const date of dates) {
    const his: number[] = [], los: number[] = []
    seen.forEach((m, n) => {
      for (let k = -AROUND; k <= AROUND; k++) {
        const v = m.get(yearsBack(addDays(date, k), n + 1))
        if (v) { his.push(v.hi); los.push(v.lo) }
      }
    })
    if (his.length) out[date] = { lo: mean(los), hi: mean(his) }
  }
  return out
}

const datesIn = (from: string, to: string) => { const xs: string[] = []; for (let d = from; d <= to; d = addDays(d, 1)) xs.push(d); return xs }

// a forecast is good for a few hours; what was, or usually is, doesn't change
const KEEP: Record<DayKind, number> = { forecast: 6 * 3_600_000, was: 30 * 86_400_000, usual: 30 * 86_400_000 }

async function get(url: string): Promise<Daily> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`weather ${res.status}`)
  return (await res.json()) as Daily
}

export async function fetchDayTemps(ask: DayAsk, unit: Unit): Promise<Record<string, DayTemp>> {
  const key = `dayweather:${ask.at.lat},${ask.at.lng}:${ask.kind}:${ask.from}_${ask.to}:${unit}`
  let cached: { at: number; value: Record<string, DayTemp> } | null = null
  try { cached = JSON.parse(localStorage.getItem(key) ?? 'null') } catch { /* unreadable: ask again */ }
  if (cached && Date.now() - cached.at < KEEP[ask.kind]) return cached.value
  try {
    let value: Record<string, DayTemp>
    if (ask.kind === 'usual') {
      const from = addDays(ask.from, -AROUND), to = addDays(ask.to, AROUND)
      const years = await Promise.all([1, 2, 3].map((n) => get(weatherUrl('archive', ask.at, yearsBack(from, n), yearsBack(to, n), unit))))
      value = usualFrom(datesIn(ask.from, ask.to), years)
    } else {
      const answer = await get(weatherUrl(ask.kind === 'was' ? 'archive' : 'forecast', ask.at, ask.from, ask.to, unit))
      value = {}
      for (const [d, v] of byDate(answer)) value[d] = { lo: Math.round(v.lo), hi: Math.round(v.hi) }
    }
    try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), value })) } catch { /* storage full */ }
    return value
  } catch (e) {
    if (cached) return cached.value
    throw e
  }
}

// every listed day's low and high; days whose weather isn't known (yet) are missing
export function useDayTemps(days: { date: string; at: Point }[], today: string): Map<string, DayShown> {
  const unit = unitHere()
  const asks = dayAsks(days, today)
  return useQueries({
    queries: asks.map((ask) => ({
      queryKey: ['dayweather', ask, unit],
      queryFn: () => fetchDayTemps(ask, unit),
      staleTime: KEEP[ask.kind],
      retry: 0,
    })),
    combine: (results) => {
      const out = new Map<string, DayShown>()
      const wanted = new Map(days.map((d) => [d.date, `${coarse(d.at).lat},${coarse(d.at).lng}`]))
      results.forEach((r, i) => {
        const ask = asks[i]
        for (const [date, t] of Object.entries(r.data ?? {})) {
          if (wanted.get(date) === `${ask.at.lat},${ask.at.lng}`) out.set(date, { ...t, kind: ask.kind })
        }
      })
      return out
    },
  })
}

const signed = (n: number) => (n < 0 ? `−${-n}` : `${n}`)

// "4°–12°", low to high
export const dayTempWords = (t: DayTemp): string => `${signed(t.lo)}°–${signed(t.hi)}°`
