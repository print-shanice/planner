import { clashes } from '../../src/lib/clash'
import { countryStatus, tripsInCountry, homeTotals, homeLists, ancestors, descendants, globePins } from '../../src/lib/countries'
import { readFileSync } from 'node:fs'
import { cityKey, knownCities, realCity } from '../../src/lib/knownCities'
import { trip, stop, place } from '../factories'

// the list of cities, as the app loads it
const known = knownCities(JSON.parse(readFileSync('public/globe/known-cities.json', 'utf8')))

describe('clashes', () => {
  it('parent home stay does not clash with a side-trip hotel', () => {
    const p = trip({ id: 'p', start_date: '2027-01-28', end_date: '2027-07-13' })
    const c = trip({ id: 'c', parent_id: 'p' })
    const set = clashes([p, c], [
      stop({ id: 'home', trip_id: 'p', kind: 'stay', day: '2027-01-28', end_date: '2027-06-26' }),
      stop({ id: 'hotel', trip_id: 'c', kind: 'stay', day: '2027-02-07', end_date: '2027-02-11' }),
    ])
    expect(set.size).toBe(0)
  })

  it('overlapping stays in sibling trips clash', () => {
    const p = trip({ id: 'p' })
    const a = trip({ id: 'a', parent_id: 'p', start_date: '2027-02-14', end_date: '2027-02-19' })
    const b = trip({ id: 'b', parent_id: 'p', start_date: '2027-02-17', end_date: '2027-02-22' })
    const set = clashes([p, a, b], [
      stop({ id: 'x', trip_id: 'a', kind: 'stay', day: '2027-02-14', end_date: '2027-02-19' }),
      stop({ id: 'y', trip_id: 'b', kind: 'stay', day: '2027-02-17', end_date: '2027-02-22' }),
    ])
    expect([...set].sort()).toEqual(['a', 'b', 'x', 'y'])
  })

  it('back-to-back stays and trips do not clash', () => {
    const p = trip({ id: 'p' })
    const a = trip({ id: 'a', parent_id: 'p', start_date: '2027-02-07', end_date: '2027-02-11' })
    const b = trip({ id: 'b', parent_id: 'p', start_date: '2027-02-11', end_date: '2027-02-14' })
    const set = clashes([p, a, b], [
      stop({ trip_id: 'p', kind: 'stay', day: '2027-02-07', end_date: '2027-02-11' }),
      stop({ trip_id: 'p', kind: 'stay', day: '2027-02-11', end_date: '2027-02-14' }),
    ])
    expect(set.size).toBe(0)
  })
})

describe('globe', () => {
  const past = trip({ id: 'past', end_date: '2026-10-01', start_date: '2026-09-20' })
  const future = trip({ id: 'fut', start_date: '2027-02-07', end_date: '2027-02-11' })

  it('been vs planned, from places and journey ends', () => {
    const s = countryStatus([past, future], [
      stop({ trip_id: 'past', day: '2026-09-21', place: place({ country: 'jp' }) }),
      stop({ trip_id: 'fut', place: place({ country: 'FI' }) }),
      stop({ trip_id: 'fut', kind: 'journey', origin: place({ country: 'NL' }), destination: place({ country: 'FI' }) }),
    ], '2026-11-05')
    expect(s.get('JP')).toBe('been')
    expect(s.get('FI')).toBe('planned')
    expect(s.get('NL')).toBe('planned')
  })

  it('been wins over planned for the same country', () => {
    const s = countryStatus([past, future], [
      stop({ trip_id: 'past', day: '2026-09-21', place: place({ country: 'JP' }) }),
      stop({ trip_id: 'fut', place: place({ country: 'JP' }) }),
    ], '2026-11-05')
    expect(s.get('JP')).toBe('been')
  })

  it('trip base counts', () => {
    const s = countryStatus([trip({ id: 'b', end_date: '2027-07-13', base: place({ country: 'NL' }) })], [], '2026-11-05')
    expect(s.get('NL')).toBe('planned')
  })

  it('tripsInCountry returns the deepest trips that went there', () => {
    const p = trip({ id: 'p' })
    const c = trip({ id: 'c', parent_id: 'p' })
    const out = tripsInCountry('FI', [p, c], [stop({ trip_id: 'c', place: place({ country: 'FI' }) })])
    expect(out.map((t) => t.id)).toEqual(['c'])
  })

  // the totals are a life lived, not a wish list: only what has happened counts
  it('home totals count the countries, cities and trips that have happened', () => {
    const p = trip({ id: 'p', start_date: '2027-01-28', end_date: '2027-07-13' })
    const c = trip({ id: 'c', parent_id: 'p', start_date: '2027-02-07', end_date: '2027-02-11' })
    const later = trip({ id: 'later', start_date: '2027-08-01', end_date: '2027-08-09', base: place({ city: 'tokyo', country: 'JP', lat: 35.68, lng: 139.77 }) })
    const someday = trip({ id: 'someday', start_date: null, end_date: null })
    const stops = [
      stop({ trip_id: 'c', day: '2027-02-08', place: place({ name: 'arktikum', city: 'rovaniemi', country: 'FI', lat: 66.51, lng: 25.72 }) }),
      stop({ trip_id: 'c', day: '2027-02-09', place: place({ name: 'santa claus village', city: 'Rovaniemi', country: 'FI', lat: 66.54, lng: 25.85 }) }),
      stop({ trip_id: 'p', day: '2027-05-02', place: place({ name: 'acropolis', city: 'athens', country: 'GR', lat: 37.97, lng: 23.73 }) }),
      stop({ trip_id: 'later', day: '2027-08-02', place: place({ name: 'senso-ji', city: 'tokyo', country: 'JP', lat: 35.71, lng: 139.8 }) }),
      stop({ trip_id: 'p', day: null, saved: true, place: place({ name: 'keukenhof', city: 'lisse', country: 'NL' }) }),
    ]
    expect(homeTotals([p, c, later, someday], stops, '2027-03-01', known)).toEqual({ countries: 1, cities: 1, trips: 2 })
    expect(homeTotals([p, c, later, someday], stops, '2027-09-01', known)).toEqual({ countries: 3, cities: 3, trips: 3 })
    expect(homeTotals([p, c, later, someday], stops, '2026-12-01', known)).toEqual({ countries: 0, cities: 0, trips: 0 })
  })

  it('home lists name what the totals count', () => {
    const p = trip({ id: 'p', name: 'exchange', start_date: '2027-01-28', end_date: '2027-07-13' })
    const c = trip({ id: 'c', parent_id: 'p', name: 'lapland', start_date: '2027-02-07', end_date: '2027-02-11' })
    const later = trip({ id: 'later', name: 'japan', start_date: '2027-08-01', end_date: '2027-08-09' })
    expect(homeLists([p, c, later], [
      stop({ trip_id: 'c', day: '2027-02-08', place: place({ name: 'arktikum', city: 'rovaniemi', country: 'FI', lat: 66.51, lng: 25.72 }) }),
      stop({ trip_id: 'c', day: '2027-02-09', place: place({ name: 'santa claus village', city: 'Rovaniemi', country: 'FI', lat: 66.54, lng: 25.85 }) }),
      stop({ trip_id: 'p', day: '2027-02-20', place: place({ name: 'acropolis', city: 'athens', country: 'GR', lat: 37.97, lng: 23.73 }) }),
      stop({ trip_id: 'later', day: '2027-08-02', place: place({ name: 'senso-ji', city: 'tokyo', country: 'JP', lat: 35.71, lng: 139.8 }) }),
    ], '2027-03-01', known)).toEqual({ countries: ['finland', 'greece'], cities: ['athens', 'rovaniemi'], trips: ['exchange', 'lapland'] })
  })

  // a city is one the globe knows, not whatever town an address names
  it('suburbs and villages are not cities; real ones are, day trips too', () => {
    const jp = trip({ id: 'jp', start_date: '2027-04-01', end_date: '2027-04-20' })
    const tw = trip({ id: 'tw', start_date: '2027-05-01', end_date: '2027-05-05' })
    const at = (day: string, city: string, lat: number, lng: number, o = {}) =>
      stop({ trip_id: 'jp', day, place: place({ name: city, city, country: 'JP', lat, lng }), ...o })
    const stops = [
      at('2027-04-02', 'Akiruno', 35.73, 139.29),
      at('2027-04-03', 'Akishima', 35.71, 139.35),
      at('2027-04-04', 'Shibuya City', 35.66, 139.7),
      at('2027-04-05', 'Kyoto', 35.0, 135.77),
      at('2027-04-06', 'Osaka', 34.67, 135.5),
      at('2027-04-07', 'Nara', 34.68, 135.8),
      at('2027-04-08', 'Kobe', 34.69, 135.19),
      at('2027-04-09', 'Hakone', 35.23, 139.02, { kind: 'stay' }),
      stop({ trip_id: 'tw', day: '2027-05-02', place: place({ name: 'taipei 101', city: 'Taipei City', country: 'TW', lat: 25.03, lng: 121.56 }) }),
    ]
    expect(homeLists([jp, tw], stops, '2027-06-01', known).cities).toEqual(['hakone', 'kobe', 'kyoto', 'nara', 'osaka', 'taipei city', 'tokyo'])
    // before the globe's list has loaded, only where you stayed counts
    expect(homeLists([jp, tw], stops, '2027-06-01').cities).toEqual(['hakone'])
  })
})

describe('real cities', () => {
  it('reads names the same with or without accents or a "city" on the end', () => {
    expect(cityKey('Ōsaka')).toBe('osaka')
    expect(cityKey('Taipei City')).toBe('taipei')
    expect(cityKey('Kyoto-shi')).toBe('kyoto')
  })

  it('a copy saved in an older shape is skipped, not a crash', () => {
    expect(knownCities([{ n: 'tokyo', z: 1.7, lng: 139.75, lat: 35.69 }] as never).size).toBe(0)
    expect(knownCities({ features: [] } as never).size).toBe(0)
  })

  it('a name only matches the city of that name nearby', () => {
    expect(realCity('Paris', { lat: 48.86, lng: 2.35 }, known)).toBe('Paris')
    expect(realCity('Paris', { lat: 33.66, lng: -95.56 }, known)).toBeNull()
  })
})

describe('tree', () => {
  it('ancestors are root first', () => {
    const ts = [trip({ id: 'a' }), trip({ id: 'b', parent_id: 'a' }), trip({ id: 'c', parent_id: 'b' })]
    expect(ancestors('c', ts).map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('descendants is cycle safe', () => {
    const ts = [trip({ id: 'a', parent_id: 'b' }), trip({ id: 'b', parent_id: 'a' })]
    expect(descendants('a', ts).sort()).toEqual(['a', 'b'])
  })
})

describe('visited by date', () => {
  const ex = trip({ id: 'ex', start_date: '2027-01-28', end_date: '2027-07-13', base: place({ country: 'NL', city: 'Eindhoven' }) })

  it('a place turns been once its day arrives, not when the trip ends', () => {
    const stops = [stop({ trip_id: 'ex', day: '2027-02-01', place: place({ country: 'BE' }) })]
    expect(countryStatus([ex], stops, '2027-01-31').get('BE')).toBe('planned')
    expect(countryStatus([ex], stops, '2027-02-01').get('BE')).toBe('been')
  })

  it('a trip base turns been once the trip starts', () => {
    expect(countryStatus([ex], [], '2027-01-27').get('NL')).toBe('planned')
    expect(countryStatus([ex], [], '2027-01-28').get('NL')).toBe('been')
  })

  it('a saved place with no day never counts as been', () => {
    const stops = [stop({ trip_id: 'ex', day: null, saved: true, place: place({ country: 'DE' }) })]
    expect(countryStatus([ex], stops, '2027-07-14').get('DE')).toBe('planned')
  })

  it('an undated stop turns been once its trip has ended', () => {
    const stops = [stop({ trip_id: 'ex', day: null, place: place({ country: 'DE' }) })]
    expect(countryStatus([ex], stops, '2027-07-13').get('DE')).toBe('planned')
    expect(countryStatus([ex], stops, '2027-07-14').get('DE')).toBe('been')
  })
})

describe('globe pins', () => {
  const today = '2027-03-01'
  const ex = trip({ id: 'ex', start_date: '2027-01-28', end_date: '2027-07-13' })
  const at = (name: string, city: string, country: string, lat: number, lng: number) => place({ name, city, country, lat, lng })

  it('one pin per country with its cities in visit order, deduped', () => {
    const pins = globePins([ex], [
      stop({ trip_id: 'ex', day: '2027-02-10', place: at('sintra palace', 'Sintra', 'PT', 38.79, -9.39) }),
      stop({ trip_id: 'ex', day: '2027-02-08', place: at('time out market', 'Lisbon', 'PT', 38.71, -9.15) }),
      stop({ trip_id: 'ex', day: '2027-02-09', place: at('belem tower', 'lisbon', 'PT', 38.69, -9.22) }),
    ], today)
    expect(pins).toHaveLength(1)
    expect(pins[0]).toMatchObject({ code: 'PT', name: 'Portugal', status: 'been', cities: ['Lisbon', 'Sintra'] })
  })

  it('the pin sits on the visited place nearest the middle', () => {
    const pins = globePins([ex], [
      stop({ trip_id: 'ex', day: '2027-02-01', place: at('a', 'Amsterdam', 'NL', 52.37, 4.9) }),
      stop({ trip_id: 'ex', day: '2027-02-02', place: at('u', 'Utrecht', 'NL', 52.09, 5.12) }),
      stop({ trip_id: 'ex', day: '2027-02-03', place: at('e', 'Eindhoven', 'NL', 51.44, 5.47) }),
    ], today)
    expect([pins[0].lat, pins[0].lng]).toEqual([52.09, 5.12])
  })

  it('a country you have been to lists only the cities you have seen', () => {
    const pins = globePins([ex], [
      stop({ trip_id: 'ex', day: '2027-02-01', place: at('dom', 'Utrecht', 'NL', 52.09, 5.12) }),
      stop({ trip_id: 'ex', day: '2027-05-01', place: at('keukenhof', 'Lisse', 'NL', 52.27, 4.55) }),
    ], today)
    expect(pins[0]).toMatchObject({ status: 'been', cities: ['Utrecht'], lat: 52.09, lng: 5.12 })
  })

  it('a planned country lists its planned cities', () => {
    const pins = globePins([ex], [stop({ trip_id: 'ex', day: '2027-05-01', place: at('louvre', 'Paris', 'FR', 48.86, 2.34) })], today)
    expect(pins[0]).toMatchObject({ code: 'FR', status: 'planned', cities: ['Paris'] })
  })

  it('journey ends count, using the stop name when there is no city', () => {
    const pins = globePins([ex], [stop({
      trip_id: 'ex', kind: 'journey', day: '2027-02-07',
      origin: place({ name: 'Eindhoven', country: 'NL', lat: 51.45, lng: 5.37 }),
      destination: place({ name: 'Rovaniemi', country: 'FI', lat: 66.56, lng: 25.83 }),
    })], today)
    expect(pins.map((p) => [p.code, p.cities])).toEqual([['FI', ['Rovaniemi']], ['NL', ['Eindhoven']]])
  })

  it('a country with no located place gets no pin but keeps its colour', () => {
    const stops = [stop({ trip_id: 'ex', day: '2027-02-01', place: place({ country: 'BE', lat: null, lng: null }) })]
    expect(globePins([ex], stops, today)).toEqual([])
    expect(countryStatus([ex], stops, today).get('BE')).toBe('been')
  })
})

describe('bad coordinates', () => {
  it('a place with impossible coordinates gets no pin but keeps its colour', () => {
    const ex = trip({ id: 'ex', start_date: '2027-01-28', end_date: '2027-07-13' })
    const stops = [
      stop({ trip_id: 'ex', day: '2027-02-01', place: place({ country: 'JP', lat: 139.7, lng: 35.7 }) }),
      stop({ trip_id: 'ex', day: '2027-02-02', place: place({ country: 'KR', lat: Number.NaN, lng: 127 }) }),
    ]
    expect(globePins([ex], stops, '2027-03-01')).toEqual([])
    expect(countryStatus([ex], stops, '2027-03-01').get('JP')).toBe('been')
  })
})

import { tripCountries } from '../../src/lib/countries'
import { place as pl, stop as st, trip as tr } from '../factories'

describe('tripCountries: the flags a trip wears', () => {
  it("starts with the trip's base, then its side trips' bases and the places planned in it, each once", () => {
    const ex = tr({ id: 'ex', base: pl({ country: 'NL' }) })
    const lap = tr({ id: 'lap', parent_id: 'ex', base: pl({ country: 'fi' }) })
    const stops = [st({ trip_id: 'lap', place: pl({ country: 'SE' }) }), st({ trip_id: 'ex', place: pl({ country: 'NL' }) }), st({ trip_id: 'other', place: pl({ country: 'JP' }) })]
    expect(tripCountries(ex, [ex, lap], stops)).toEqual(['NL', 'FI', 'SE'])
    expect(tripCountries(lap, [ex, lap], stops)).toEqual(['FI', 'SE'])
  })
  it('an idea saved for later is not a destination; a journey only counts when nothing else says where', () => {
    const t = tr({ id: 't', base: null })
    const fly = st({ trip_id: 't', kind: 'journey', origin: pl({ country: 'NL' }), destination: pl({ country: 'GR' }) })
    expect(tripCountries(t, [t], [st({ trip_id: 't', saved: true, day: null, place: pl({ country: 'FR' }) }), fly])).toEqual(['GR'])
    expect(tripCountries(t, [t], [])).toEqual([])
  })
})
