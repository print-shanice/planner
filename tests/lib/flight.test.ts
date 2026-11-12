import { canCheck, endBits, flightError, flightNumber, invokeFlight, statusUrl, statusWord, toDraft } from '../../src/lib/flight'
import type { Flight, FlightEnd } from '../../supabase/functions/flight/shape'

const invoke = vi.hoisted(() => vi.fn())
vi.mock('../../src/lib/supabase', () => ({ supabase: { functions: { invoke } } }))

function end(o: Partial<FlightEnd> = {}): FlightEnd {
  return {
    iata: 'AMS', airport: 'Amsterdam Airport Schiphol', city: 'Amsterdam', country: 'NL', lat: 52.31, lng: 4.76,
    scheduled: '2027-02-15 07:20+01:00', revised: null, terminal: null, gate: null, desk: null, belt: null, ...o,
  }
}
function flight(o: Partial<Flight> = {}): Flight {
  return {
    number: 'KL 1001', airline: 'KLM', status: 'Expected', live: false, checked_at: '2027-02-15T05:00:00.000Z',
    dep: end(), arr: end({ iata: 'LHR', airport: 'London Heathrow', city: 'London', country: 'GB', scheduled: '2027-02-15 07:40+00:00' }), ...o,
  }
}

describe('flightNumber: what was typed, as a flight number', () => {
  it('tidies the usual ways of writing one', () => {
    expect(flightNumber('kl1001')).toBe('KL 1001')
    expect(flightNumber(' Kl 1001 ')).toBe('KL 1001')
    expect(flightNumber('u21234')).toBe('U2 1234')
    expect(flightNumber('FR3091')).toBe('FR 3091')
    expect(flightNumber('klm 1001')).toBe('KLM 1001')
  })
  it('is null for anything else', () => {
    expect(flightNumber('hello')).toBeNull()
    expect(flightNumber('')).toBeNull()
    expect(flightNumber('KL10011')).toBeNull()
    expect(flightNumber('12 345')).toBeNull()
  })
})

describe('canCheck: from a day before leaving until an hour after landing', () => {
  const at = (iso: string) => new Date(iso)
  it('opens 24 hours before the scheduled departure', () => {
    expect(canCheck(flight(), at('2027-02-14T06:19:00Z'))).toBe(false)
    expect(canCheck(flight(), at('2027-02-14T06:21:00Z'))).toBe(true)
  })
  it('closes an hour after landing, later when it lands late', () => {
    expect(canCheck(flight(), at('2027-02-15T08:39:00Z'))).toBe(true)
    expect(canCheck(flight(), at('2027-02-15T08:41:00Z'))).toBe(false)
    const late = flight({ arr: { ...flight().arr, revised: '2027-02-15 09:00+00:00' } })
    expect(canCheck(late, at('2027-02-15T09:59:00Z'))).toBe(true)
  })
})

describe('endBits: what each end of the flight has to say', () => {
  it('leaving: terminal, gate, check-in desk', () => {
    expect(endBits(end({ terminal: '2', gate: 'E21', desk: '9-16', belt: '3' }), 'dep')).toEqual(['terminal 2', 'gate e21', 'check-in 9-16'])
  })
  it('landing: terminal and belt', () => {
    expect(endBits(end({ terminal: '4', gate: 'B1', desk: '9', belt: '8' }), 'arr')).toEqual(['terminal 4', 'belt 8'])
  })
  it('leaves out what is not known', () => {
    expect(endBits(end(), 'dep')).toEqual([])
  })
})

describe('statusWord', () => {
  const said = (status: string, o: Partial<Flight> = {}) => statusWord(flight({ status, ...o }))
  it('warns, in words, when something is wrong', () => {
    expect(said('Delayed', { dep: end({ revised: '2027-02-15 16:45+01:00' }) })).toEqual({ text: 'delayed · leaves 16:45', warn: true })
    expect(said('Delayed')).toEqual({ text: 'delayed', warn: true })
    expect(said('Canceled')).toEqual({ text: 'cancelled', warn: true })
    expect(said('CanceledUncertain')).toEqual({ text: 'cancelled', warn: true })
    expect(said('Diverted')).toEqual({ text: 'diverted', warn: true })
  })
  it('says where the flight is otherwise', () => {
    expect(said('Boarding')).toEqual({ text: 'boarding', warn: false })
    expect(said('GateClosed')).toEqual({ text: 'gate closed', warn: false })
    expect(said('Departed')).toEqual({ text: 'in the air', warn: false })
    expect(said('EnRoute')).toEqual({ text: 'in the air', warn: false })
    expect(said('Arrived')).toEqual({ text: 'landed', warn: false })
  })
  it('says nothing when all is as planned', () => {
    expect(said('Expected')).toBeNull()
    expect(said('Unknown')).toBeNull()
  })
})

describe('toDraft: the form fields a flight fills in', () => {
  it('fills airports, days and local times', () => {
    const ba = flight({
      number: 'BA 117',
      dep: end({ iata: 'LHR', airport: 'London Heathrow', city: 'London', country: 'GB', lat: 51.47, lng: -0.45, scheduled: '2026-11-11 08:20+00:00' }),
      arr: end({ iata: 'JFK', airport: 'John F Kennedy', city: 'New York', country: 'US', lat: 40.64, lng: -73.78, scheduled: '2026-11-11 11:20-05:00' }),
    })
    expect(toDraft(ba)).toEqual({
      title: 'BA 117',
      origin: { name: 'London Heathrow', city: 'London', country: 'GB', lat: 51.47, lng: -0.45 },
      destination: { name: 'John F Kennedy', city: 'New York', country: 'US', lat: 40.64, lng: -73.78 },
      day: '2026-11-11', time: '08:20', end_date: '2026-11-11', end_time: '11:20',
    })
  })
  it('lands on the next day when the flight does', () => {
    const night = flight({ arr: end({ scheduled: '2026-11-12 06:05+09:00' }) })
    expect(toDraft(night)).toMatchObject({ end_date: '2026-11-12', end_time: '06:05' })
  })
  it('leaves out a city or country it does not know', () => {
    const bare = flight({ dep: end({ city: '', country: null, lat: null, lng: null }) })
    expect(toDraft(bare).origin).toEqual({ name: 'Amsterdam Airport Schiphol', lat: null, lng: null })
  })
})

describe('flightError: what to tell people', () => {
  it('says each case plainly', () => {
    expect(flightError('not_found', 'KL 1001', '2027-02-17')).toBe('no kl 1001 on 17 feb')
    expect(flightError('quota', 'KL 1001', '2027-02-17')).toBe('lookups used up this month')
    expect(flightError('unavailable', 'KL 1001', '2027-02-17')).toBe("couldn't look it up, try again")
    expect(flightError('offline', 'KL 1001', '2027-02-17')).toBe('offline')
    expect(flightError('not_flight', 'KL 1001', '2027-02-17')).toBe('add the flight number and day first')
  })
})

describe('statusUrl', () => {
  it('opens the flight on flightradar24', () => {
    expect(statusUrl('KL 1001')).toBe('https://www.flightradar24.com/data/flights/kl1001')
  })
})

describe('invokeFlight: asking the flight function', () => {
  beforeEach(() => { invoke.mockReset() })
  it('sends the body and gives back the flight', async () => {
    invoke.mockResolvedValue({ data: { flight: flight() }, error: null })
    expect(await invokeFlight({ number: 'KL 1001', date: '2027-02-15' })).toEqual(flight())
    expect(invoke).toHaveBeenCalledWith('flight', { body: { number: 'KL 1001', date: '2027-02-15' } })
  })
  it('passes the known errors through', async () => {
    invoke.mockResolvedValue({ data: { error: 'quota' }, error: null })
    expect(await invokeFlight({ stop: 's1' })).toBe('quota')
  })
  it('returns all departures when the lookup requires a choice', async () => {
    const flights = [flight(), flight({ dep: end({ scheduled: '2027-02-15 18:20+01:00' }) })]
    invoke.mockResolvedValue({ data: { flights }, error: null })
    expect(await invokeFlight({ number: 'KL 1001', date: '2027-02-15' })).toEqual(flights)
    invoke.mockResolvedValue({ data: { error: 'ambiguous' }, error: null })
    expect(await invokeFlight({ stop: 's1' })).toBe('ambiguous')
  })
  it('calls anything else unavailable', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('FunctionsHttpError') })
    expect(await invokeFlight({ stop: 's1' })).toBe('unavailable')
    invoke.mockResolvedValue({ data: { error: 'signed_out' }, error: null })
    expect(await invokeFlight({ stop: 's1' })).toBe('unavailable')
    invoke.mockImplementation(() => Promise.reject(new Error('network')))
    expect(await invokeFlight({ stop: 's1' })).toBe('unavailable')
  })
})
