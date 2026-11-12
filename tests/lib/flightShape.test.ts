import { toFlight, toFlights } from '../../supabase/functions/flight/shape'

const now = new Date('2026-11-11T15:00:00Z')

// shaped like aerodatabox's flight-by-number answer
function end(o: Record<string, unknown> = {}) {
  return {
    airport: { iata: 'AMS', name: 'Amsterdam Airport Schiphol', shortName: 'Schiphol', municipalityName: 'Amsterdam', countryCode: 'NL', location: { lat: 52.31, lon: 4.76 } },
    scheduledTime: { utc: '2027-02-15 06:20Z', local: '2027-02-15 07:20+01:00' },
    quality: ['Basic'],
    ...o,
  }
}
function raw(o: Record<string, unknown> = {}) {
  return {
    number: 'KL 1001', airline: { name: 'KLM' }, status: 'Expected', codeshareStatus: 'Unknown',
    departure: end(),
    arrival: end({
      airport: { iata: 'LHR', name: 'London Heathrow', shortName: 'Heathrow', municipalityName: 'London', countryCode: 'GB', location: { lat: 51.47, lon: -0.45 } },
      scheduledTime: { utc: '2027-02-15 07:40Z', local: '2027-02-15 07:40+00:00' },
      terminal: '4',
    }),
    ...o,
  }
}

describe('toFlight: the trimmed flight a journey keeps', () => {
  it('reads both ends', () => {
    const f = toFlight([raw()], '2027-02-15', now)!
    expect(f.number).toBe('KL 1001')
    expect(f.airline).toBe('KLM')
    expect(f.status).toBe('Expected')
    expect(f.live).toBe(false)
    expect(f.checked_at).toBe('2026-11-11T15:00:00.000Z')
    expect(f.dep).toEqual({
      iata: 'AMS', airport: 'Amsterdam Airport Schiphol', city: 'Amsterdam', country: 'NL', lat: 52.31, lng: 4.76,
      scheduled: '2027-02-15 07:20+01:00', revised: null, terminal: null, gate: null, desk: null, belt: null,
    })
    expect(f.arr.iata).toBe('LHR')
    expect(f.arr.terminal).toBe('4')
    expect(f.arr.scheduled).toBe('2027-02-15 07:40+00:00')
  })

  it('reads what the day brings: revised times, gate, desk, belt, live', () => {
    const f = toFlight([raw({
      status: 'Delayed',
      departure: end({ terminal: '2', gate: 'E21', checkInDesk: '9-16', revisedTime: { local: '2027-02-15 07:45+01:00' }, quality: ['Basic', 'Live'] }),
      arrival: end({ baggageBelt: '8' }),
    })], '2027-02-15', now)!
    expect(f.live).toBe(true)
    expect(f.dep).toMatchObject({ terminal: '2', gate: 'E21', desk: '9-16', revised: '2027-02-15 07:45+01:00' })
    expect(f.arr.belt).toBe('8')
  })

  it('turns empty or missing values into null', () => {
    const f = toFlight([raw({
      airline: undefined,
      departure: end({ terminal: '', gate: '  ', airport: { iata: 'EIN', name: 'Eindhoven' } }),
    })], '2027-02-15', now)!
    expect(f.airline).toBe('')
    expect(f.dep).toMatchObject({ terminal: null, gate: null, airport: 'Eindhoven', city: '', country: null, lat: null, lng: null })
  })

  it('picks the flight leaving on the asked day', () => {
    const late = raw({ departure: end({ scheduledTime: { local: '2027-02-14 23:50+01:00' } }) })
    const right = raw({ departure: end({ gate: 'D4' }) })
    expect(toFlight([late, right], '2027-02-15', now)!.dep.gate).toBe('D4')
    expect(toFlight([late], '2027-02-15', now)).toBeNull()
  })

  it('keeps local times across time zones as given', () => {
    const f = toFlight([raw({
      number: 'BA 117',
      departure: end({ scheduledTime: { local: '2026-11-11 08:20+00:00' } }),
      arrival: end({ scheduledTime: { local: '2026-11-11 11:20-05:00' } }),
    })], '2026-11-11', now)!
    expect(f.dep.scheduled).toBe('2026-11-11 08:20+00:00')
    expect(f.arr.scheduled).toBe('2026-11-11 11:20-05:00')
  })

  it('is null when nothing came back', () => {
    expect(toFlight([], '2027-02-15', now)).toBeNull()
    expect(toFlight([{ number: 'KL 1001' }], '2027-02-15', now)).toBeNull()
  })
})

describe('toFlights: distinct departures on the requested local date', () => {
  it('returns all distinct departures in local time order, without duplicate provider records', () => {
    const early = raw()
    const late = raw({ departure: end({ scheduledTime: { local: '2027-02-15 18:20+01:00' } }) })
    const previous = raw({ departure: end({ scheduledTime: { local: '2027-02-14 07:20+01:00' } }) })
    expect(toFlights([late, early, early, previous], '2027-02-15', now).map((f) => f.dep.scheduled))
      .toEqual(['2027-02-15 07:20+01:00', '2027-02-15 18:20+01:00'])
    expect(toFlight([early, late], '2027-02-15', now)).toBeNull()
  })

  it('keeps different routes with the same number and departure time', () => {
    const other = raw({ arrival: end({ airport: { iata: 'EDI', name: 'Edinburgh Airport' } }) })
    expect(toFlights([raw(), other], '2027-02-15', now).map((f) => f.arr.iata).sort()).toEqual(['EDI', 'LHR'])
  })
})
