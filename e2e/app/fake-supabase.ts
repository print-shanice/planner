/* eslint-disable @typescript-eslint/no-explicit-any */
// an in-memory stand-in for supabase: the made-up data, saved only until the page reloads.
// ?signedout opens on the sign-in screen (the code is 123456); ?fail makes every write fail
import { data as seed } from './data'

export const configProblem = null
const db: Record<string, any[]> = JSON.parse(JSON.stringify(seed))
const params = new URLSearchParams(location.search)
const fail = params.has('fail')
const wait = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 120))

function builder(table: string) {
  let op: 'select' | 'insert' | 'update' | 'delete' = 'select'
  let payload: any = null
  let id: string | null = null
  let single = false
  const run = () => {
    if (fail && op !== 'select') return wait({ data: null, error: { message: 'nope', code: '500' }, status: 500 })
    const rows = (db[table] ??= [])
    if (op === 'select') return wait({ data: rows.slice(), error: null, status: 200 })
    if (op === 'insert') { const r = Array.isArray(payload) ? payload : [payload]; rows.push(...r); return wait({ data: single ? r[0] : r, error: null, status: 201 }) }
    if (op === 'update') { const r = rows.find((x) => x.id === id); Object.assign(r ?? {}, payload); return wait({ data: r, error: null, status: 200 }) }
    db[table] = rows.filter((x) => x.id !== id)
    return wait({ data: null, error: null, status: 204 })
  }
  const b: any = {
    select: () => b,
    insert: (p: any) => { op = 'insert'; payload = p; return b },
    update: (p: any) => { op = 'update'; payload = p; return b },
    upsert: (p: any) => { op = 'insert'; payload = p; return b },
    delete: () => { op = 'delete'; return b },
    eq: (_k: string, v: string) => { id = v; return b },
    in: () => b,
    order: () => b,
    single: () => { single = true; return b },
    then: (res: any, rej: any) => run().then(res, rej),
  }
  return b
}

type Session = { user: { id: string; email: string } } | null
const me = { user: { id: 'u-shanice', email: 'shanice@example.com' } }
let session: Session = params.has('signedout') ? null : me
const listeners: ((event: string, s: Session) => void)[] = []
const announce = (event: string) => { for (const l of listeners) l(event, session) }

// the flight function: 'XX 123' is a made-up flight, anything else isn't found
const fakeFlight = (date: string) => {
  const end = (iata: string, airport: string, city: string, country: string, lat: number, lng: number, time: string, o: object = {}) =>
    ({ iata, airport, city, country, lat, lng, scheduled: `${date} ${time}`, revised: null, terminal: null, gate: null, desk: null, belt: null, ...o })
  return {
    number: 'XX 123', airline: 'made-up air', status: 'Expected', live: false, checked_at: new Date().toISOString(),
    dep: end('AAA', 'first airport', 'first city', 'NL', 51.45, 5.37, '09:00+01:00', { terminal: '1' }),
    arr: end('BBB', 'second airport', 'second city', 'ES', 41.3, 2.08, '11:10+01:00'),
  }
}
const functions = {
  invoke: (_name: string, { body }: { body: { number?: string; date?: string; stop?: string } }) =>
    wait({ data: body.number?.replace(/\s+/g, '').toUpperCase() === 'XX123' ? { flight: fakeFlight(body.date ?? '2027-02-15') } : { error: 'not_found' }, error: null }),
}

const ch: any = { on: () => ch, subscribe: () => ch }
export const supabase: any = {
  from: builder,
  functions,
  rpc: () => wait({ data: null, error: null }),
  channel: () => ch,
  removeChannel: () => {},
  auth: {
    getSession: () => wait({ data: { session } }),
    onAuthStateChange: (fn: (event: string, s: Session) => void) => { listeners.push(fn); return { data: { subscription: { unsubscribe() { listeners.splice(listeners.indexOf(fn), 1) } } } } },
    signOut: async () => { session = null; announce('SIGNED_OUT'); return { error: null } },
    signInWithOtp: ({ email }: { email: string }) => wait(email.endsWith('@example.com') ? { error: null } : { error: { message: 'Signups not allowed for otp' } }),
    verifyOtp: async ({ token }: { token: string }) => {
      await wait(null)
      if (token !== '123456') return { error: { message: 'Token has expired or is invalid' } }
      session = me
      announce('SIGNED_IN')
      return { error: null }
    },
  },
  storage: {
    from: () => ({
      upload: () => wait({ error: null }),
      remove: () => wait({ error: null }),
      download: () => wait({ data: new Blob(['x']), error: null }),
      createSignedUrls: () => wait({ data: [], error: null }),
    }),
  },
}
