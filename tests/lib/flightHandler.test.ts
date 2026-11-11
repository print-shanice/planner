import { handle, type Db, type Deps } from '../../supabase/functions/flight/handler'
import type { Flight } from '../../supabase/functions/flight/shape'

const now = new Date('2027-02-15T05:00:00Z')

const answer = [{
  number: 'KL 1001', airline: { name: 'KLM' }, status: 'Expected',
  departure: { airport: { iata: 'AMS' }, scheduledTime: { local: '2027-02-15 07:20+01:00' }, terminal: '2', gate: 'E21' },
  arrival: { airport: { iata: 'LHR' }, scheduledTime: { local: '2027-02-15 07:40+00:00' } },
}]

type StopRow = Awaited<ReturnType<Db['stop']>>

function setup(o: { who?: 'none' | 'stranger' | 'member'; stop?: StopRow; status?: number; body?: unknown; throws?: boolean } = {}) {
  const calls: string[] = []
  const saved: [string, Flight][] = []
  const db: Db = {
    who: async () => o.who ?? 'member',
    stop: async () => o.stop ?? null,
    saveFlight: async (id, f) => { saved.push([id, f]) },
  }
  const deps: Deps = {
    key: 'k',
    db: () => db,
    now: () => now,
    fetch: (async (url: string, init: RequestInit) => {
      calls.push(url)
      expect((init.headers as Record<string, string>)['x-rapidapi-key']).toBe('k')
      if (o.throws) throw new Error('down')
      const status = o.status ?? 200
      return new Response(status === 200 ? JSON.stringify(o.body ?? answer) : null, { status })
    }) as unknown as typeof fetch,
  }
  return { deps, calls, saved }
}

const post = (body: unknown, origin = 'https://print-shanice.github.io', auth = 'Bearer t') =>
  new Request('https://x.supabase.co/functions/v1/flight', {
    method: 'POST', body: JSON.stringify(body),
    headers: { origin, 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) },
  })

describe('the flight function', () => {
  it('answers the browser preflight from the planner', async () => {
    const r = await handle(new Request('https://x/flight', { method: 'OPTIONS', headers: { origin: 'https://print-shanice.github.io' } }), setup().deps)
    expect(r.status).toBe(200)
    expect(r.headers.get('access-control-allow-origin')).toBe('https://print-shanice.github.io')
    expect(r.headers.get('access-control-allow-headers')).toMatch(/authorization/)
  })

  it('does not name other sites as allowed', async () => {
    const r = await handle(post({ number: 'kl1001', date: '2027-02-15' }, 'https://elsewhere.example'), setup().deps)
    expect(r.headers.get('access-control-allow-origin')).not.toBe('https://elsewhere.example')
  })

  it('turns away no session (401) and people who are not members (403), without calling the api', async () => {
    const a = setup({ who: 'none' })
    expect((await handle(post({ number: 'kl1001', date: '2027-02-15' }, undefined, ''), a.deps)).status).toBe(401)
    const b = setup({ who: 'stranger' })
    expect((await handle(post({ number: 'kl1001', date: '2027-02-15' }), b.deps)).status).toBe(403)
    expect([...a.calls, ...b.calls]).toEqual([])
  })

  it('looks a number up for a day and does not save it', async () => {
    const s = setup()
    const r = await handle(post({ number: 'Kl 1001', date: '2027-02-15' }), s.deps)
    const body = await r.json()
    expect(r.status).toBe(200)
    expect(body.flight.number).toBe('KL 1001')
    expect(body.flight.dep.gate).toBe('E21')
    expect(s.calls).toEqual(['https://aerodatabox.p.rapidapi.com/flights/number/KL1001/2027-02-15?dateLocalRole=Departure'])
    expect(s.saved).toEqual([])
  })

  it('refuses a bad date or number before calling the api', async () => {
    const s = setup()
    expect((await handle(post({ number: 'kl1001', date: 'tomorrow' }), s.deps)).status).toBe(400)
    expect((await handle(post({ number: '../x', date: '2027-02-15' }), s.deps)).status).toBe(400)
    expect(s.calls).toEqual([])
  })

  it('says not_found, quota or unavailable as data', async () => {
    expect(await (await handle(post({ number: 'hv5105', date: '2027-02-17' }), setup({ status: 204 }).deps)).json()).toEqual({ error: 'not_found' })
    expect(await (await handle(post({ number: 'hv5105', date: '2027-02-17' }), setup({ body: [] }).deps)).json()).toEqual({ error: 'not_found' })
    expect(await (await handle(post({ number: 'kl1001', date: '2027-02-15' }), setup({ status: 429 }).deps)).json()).toEqual({ error: 'quota' })
    expect(await (await handle(post({ number: 'kl1001', date: '2027-02-15' }), setup({ status: 500 }).deps)).json()).toEqual({ error: 'unavailable' })
    expect(await (await handle(post({ number: 'kl1001', date: '2027-02-15' }), setup({ throws: true }).deps)).json()).toEqual({ error: 'unavailable' })
  })

  const flightStop = (flight: Partial<Flight> | null = null): StopRow =>
    ({ id: 's1', kind: 'journey', mode: 'flight', title: 'KL 1001', day: '2027-02-15', flight: flight as Flight | null })

  it('checks a saved flight again and saves what it finds', async () => {
    const s = setup({ stop: flightStop() })
    const body = await (await handle(post({ stop: 's1' }), s.deps)).json()
    expect(body.flight.dep.gate).toBe('E21')
    expect(s.saved.map(([id, f]) => [id, f.number])).toEqual([['s1', 'KL 1001']])
  })

  it('gives back the saved flight without calling the api when it was checked under 5 minutes ago', async () => {
    const recent = { number: 'KL 1001', checked_at: new Date(now.getTime() - 4 * 60_000).toISOString() }
    const s = setup({ stop: flightStop(recent) })
    expect(await (await handle(post({ stop: 's1' }), s.deps)).json()).toEqual({ flight: recent })
    expect(s.calls).toEqual([])

    const older = setup({ stop: flightStop({ ...recent, checked_at: new Date(now.getTime() - 6 * 60_000).toISOString() }) })
    await handle(post({ stop: 's1' }), older.deps)
    expect(older.calls).toHaveLength(1)
  })

  it('says not_flight for a stop that is not a dated flight with a number', async () => {
    for (const stop of [null, { ...flightStop(), mode: 'train' }, { ...flightStop(), day: null }, { ...flightStop(), title: '' }] as StopRow[]) {
      const s = setup({ stop })
      expect(await (await handle(post({ stop: 's1' }), s.deps)).json()).toEqual({ error: 'not_flight' })
      expect(s.calls).toEqual([])
    }
  })
})
