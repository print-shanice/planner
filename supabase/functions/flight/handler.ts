// looks a flight up on aerodatabox for a member of the planner.
// { number, date } only answers (the form fills itself in); { stop } also saves it on that journey.
// the key never leaves the server. no deno or npm imports, so the app's tests run it.
import { toFlight, type Flight } from './shape.ts'

export type StopRow = { id: string; kind: string; mode: string | null; title: string; day: string | null; flight: Flight | null }

export type Db = {
  // who the request's session belongs to
  who: () => Promise<'none' | 'stranger' | 'member'>
  // read through row-level security, so only the planner's own stops
  stop: (id: string) => Promise<StopRow | null>
  saveFlight: (id: string, flight: Flight) => Promise<void>
}

export type Deps = {
  key: string
  db: (authorization: string) => Db
  fetch: typeof fetch
  now: () => Date
}

export type FlightError = 'not_found' | 'quota' | 'unavailable' | 'not_flight'

const ORIGINS = ['https://print-shanice.github.io', 'http://localhost:5180', 'http://localhost:4173']
// a check this recent is given back as it is: double taps and both people pressing cost one lookup
const FRESH_MS = 5 * 60_000

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  return {
    'access-control-allow-origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
    vary: 'origin',
  }
}

const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'content-type': 'application/json' } })

async function lookUp(deps: Deps, number: string, date: string): Promise<Flight | FlightError> {
  const url = `https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(number)}/${date}?dateLocalRole=Departure`
  let res: Response
  try {
    res = await deps.fetch(url, {
      headers: { 'x-rapidapi-key': deps.key, 'x-rapidapi-host': 'aerodatabox.p.rapidapi.com' },
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    return 'unavailable'
  }
  if (res.status === 204 || res.status === 404) return 'not_found'
  if (res.status === 429) return 'quota'
  if (!res.ok) return 'unavailable'
  try {
    const raw = await res.json()
    return (Array.isArray(raw) ? toFlight(raw, date, deps.now()) : null) ?? 'not_found'
  } catch {
    return 'unavailable'
  }
}

const NUMBER = /^[A-Z0-9]{3,8}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) })
  if (req.method !== 'POST') return json(req, 405, { error: 'method' })

  const auth = req.headers.get('authorization') ?? ''
  if (!auth) return json(req, 401, { error: 'signed_out' })
  const db = deps.db(auth)
  const who = await db.who()
  if (who === 'none') return json(req, 401, { error: 'signed_out' })
  if (who !== 'member') return json(req, 403, { error: 'not_member' })

  let body: { number?: unknown; date?: unknown; stop?: unknown }
  try { body = await req.json() } catch { return json(req, 400, { error: 'bad_request' }) }

  if (typeof body.stop === 'string') {
    const s = await db.stop(body.stop)
    const typed = (s?.flight?.number ?? s?.title ?? '').replace(/\s+/g, '').toUpperCase()
    if (!s || s.kind !== 'journey' || s.mode !== 'flight' || !s.day || !NUMBER.test(typed)) return json(req, 200, { error: 'not_flight' })
    if (s.flight && deps.now().getTime() - Date.parse(s.flight.checked_at) < FRESH_MS) return json(req, 200, { flight: s.flight })
    const found = await lookUp(deps, typed, s.day)
    if (typeof found === 'string') return json(req, 200, { error: found })
    await db.saveFlight(s.id, found)
    return json(req, 200, { flight: found })
  }

  const number = typeof body.number === 'string' ? body.number.replace(/\s+/g, '').toUpperCase() : ''
  const date = typeof body.date === 'string' ? body.date : ''
  if (!NUMBER.test(number) || !DATE.test(date)) return json(req, 400, { error: 'bad_request' })
  const found = await lookUp(deps, number, date)
  return json(req, 200, typeof found === 'string' ? { error: found } : { flight: found })
}
