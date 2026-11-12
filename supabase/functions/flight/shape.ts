// the flight a journey keeps, trimmed from aerodatabox's answer.
// plain typescript with no imports, so the edge function (deno) and the app's tests share it.

export type FlightEnd = {
  iata: string
  airport: string
  city: string
  country: string | null
  lat: number | null
  lng: number | null
  // local, as aerodatabox writes it: 'yyyy-mm-dd hh:mm+hh:mm'
  scheduled: string
  revised: string | null
  terminal: string | null
  gate: string | null
  desk: string | null
  belt: string | null
}

export type Flight = {
  // as aerodatabox writes it: 'KL 1001'
  number: string
  airline: string
  // aerodatabox's status: Expected, Delayed, Canceled, Boarding…
  status: string
  // any end has live data rather than the schedule alone
  live: boolean
  // when it was looked up (iso, utc)
  checked_at: string
  dep: FlightEnd
  arr: FlightEnd
}

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {})
const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

function toEnd(v: unknown): FlightEnd | null {
  const e = obj(v)
  const a = obj(e.airport)
  const scheduled = text(obj(e.scheduledTime).local)
  if (!scheduled) return null
  const at = obj(a.location)
  return {
    iata: text(a.iata) ?? '',
    airport: text(a.name) ?? text(a.shortName) ?? '',
    city: text(a.municipalityName) ?? '',
    country: text(a.countryCode),
    lat: num(at.lat),
    lng: num(at.lon),
    scheduled,
    revised: text(obj(e.revisedTime).local),
    terminal: text(e.terminal),
    gate: text(e.gate),
    desk: text(e.checkInDesk),
    belt: text(e.baggageBelt),
  }
}

const isLive = (v: unknown) => Array.isArray(obj(v).quality) && (obj(v).quality as unknown[]).includes('Live')

// Keep every distinct departure on the requested airport-local date.
export function toFlights(raw: unknown[], date: string, now: Date): Flight[] {
  const all = raw.flatMap((r) => {
    const f = obj(r)
    const dep = toEnd(f.departure)
    const arr = toEnd(f.arrival)
    if (!dep || !arr || dep.scheduled.slice(0, 10) !== date) return []
    return [{
      number: text(f.number) ?? '',
      airline: text(obj(f.airline).name) ?? '',
      status: text(f.status) ?? 'Unknown',
      live: isLive(f.departure) || isLive(f.arrival),
      checked_at: now.toISOString(),
      dep, arr,
    }]
  })
  const distinct = new Map<string, Flight>()
  for (const f of all) {
    const key = JSON.stringify([f.dep.iata || f.dep.airport, f.arr.iata || f.arr.airport, f.dep.scheduled, f.arr.scheduled])
    if (!distinct.has(key)) distinct.set(key, f)
  }
  return [...distinct.values()].sort((a, b) => a.dep.scheduled.localeCompare(b.dep.scheduled) || a.arr.iata.localeCompare(b.arr.iata))
}

// A caller asking for one flight must never silently pick between several departures.
export function toFlight(raw: unknown[], date: string, now: Date): Flight | null {
  const flights = toFlights(raw, date, now)
  return flights.length === 1 ? flights[0] : null
}
