import { trip, stop, place } from '../factories'
import { biasFor, nearFirst, pickGuess } from '../../src/lib/guess'
import { parseSpots } from '../../src/lib/photon'

const flat = { lat: 35.75, lng: 139.68 } // tokiwadai

describe('pickGuess', () => {
  const near = (o: Partial<ReturnType<typeof place>>) => place({ lat: 35.67, lng: 139.70, ...o })
  it('takes the first result close by whose name is in what you typed, or the other way round', () => {
    expect(pickGuess('cafe de pelgrim', [near({ name: 'Elsewhere' }), near({ name: 'De Pelgrim' })], flat)?.name).toBe('De Pelgrim')
    expect(pickGuess('assort', [near({ name: 'ASSORT Tokyo' })], flat)?.name).toBe('ASSORT Tokyo')
  })
  it('never pins something far away, unrelated, or without a point to aim near', () => {
    expect(pickGuess('de pelgrim', [place({ name: 'De Pelgrim', lat: 51.15, lng: 4.45 })], flat)).toBeNull()
    expect(pickGuess('iyoshi cola', [near({ name: 'Lawson' })], flat)).toBeNull()
    expect(pickGuess('de pelgrim', [near({ name: 'De Pelgrim' })], null)).toBeNull()
    expect(pickGuess('  ', [near({ name: '' })], flat)).toBeNull()
  })
})

describe('parseSpots', () => {
  it('keeps only specific places, never areas, streets or stations', () => {
    const f = (name: string, osm_key: string) => ({ geometry: { coordinates: [139.7, 35.66] }, properties: { name, osm_key, osm_value: 'x' } })
    const out = parseSpots({ features: [f('Shibuya', 'place'), f('Nippori', 'railway'), f('Cat Street', 'highway'), f('Iyoshi Cola', 'amenity'), f('2nd Street', 'shop'), f('Hasedera', 'historic'), f('Meiji Jingu', 'tourism')] })
    expect(out.map((p) => p.name)).toEqual(['Iyoshi Cola', '2nd Street', 'Hasedera', 'Meiji Jingu'])
  })
})

describe('biasFor', () => {
  const tk = trip({ id: 'tk', start_date: '2025-09-18', end_date: '2025-09-26', base: place({ name: 'tokyo', lat: 35.68, lng: 139.76 }) })
  const airbnb = stop({ id: 'bnb', trip_id: 'tk', kind: 'stay', day: '2025-09-19', end_date: '2025-09-26', place: place({ lat: 35.75, lng: 139.68 }) })
  it("aims near that night's stay", () => {
    expect(biasFor(tk, [tk], [airbnb], '2025-09-21')).toEqual({ lat: 35.75, lng: 139.68 })
    expect(biasFor(tk, [tk], [airbnb], '2025-09-19')).toEqual({ lat: 35.75, lng: 139.68 })
  })
  it("in a side trip, its own bed that night wins over the parent's long stay", () => {
    const ex = trip({ id: 'ex', start_date: '2027-01-28', end_date: '2027-07-13' })
    const par = trip({ id: 'par', parent_id: 'ex', start_date: '2027-02-19', end_date: '2027-02-23' })
    const flat = stop({ id: 'flat', trip_id: 'ex', kind: 'stay', day: '2027-01-28', end_date: '2027-07-13', place: place({ lat: 51.448, lng: 5.49 }) })
    const hotel = stop({ id: 'hotel', trip_id: 'par', kind: 'stay', day: '2027-02-19', end_date: '2027-02-23', place: place({ lat: 48.859, lng: 2.36 }) })
    expect(biasFor(par, [ex, par], [flat, hotel], '2027-02-21')).toEqual({ lat: 48.859, lng: 2.36 })
    // and from the parent's plan, a side trip's day is aimed at the side trip's bed too
    expect(biasFor(ex, [ex, par], [flat, hotel], '2027-02-21')).toEqual({ lat: 48.859, lng: 2.36 })
    expect(biasFor(ex, [ex, par], [flat, hotel], '2027-03-10')).toEqual({ lat: 51.448, lng: 5.49 })
  })
  it("else the day's last located stop, else the trip's base, else its parent's", () => {
    const k = stop({ trip_id: 'tk', day: '2025-09-24', place: place({ lat: 35.31, lng: 139.55 }) })
    expect(biasFor(tk, [tk], [k], '2025-09-24')).toEqual({ lat: 35.31, lng: 139.55 })
    expect(biasFor(tk, [tk], [], '2025-09-24')).toEqual({ lat: 35.68, lng: 139.76 })
    const side = trip({ id: 'side', parent_id: 'tk', base: null })
    expect(biasFor(side, [tk, side], [], null)).toEqual({ lat: 35.68, lng: 139.76 })
    expect(biasFor(trip({ base: null }), [], [], null)).toBeNull()
  })
})

describe('nearFirst', () => {
  it('puts results within 50 km first, keeping their order otherwise', () => {
    const far = place({ name: 'edegem', lat: 51.15, lng: 4.45 })
    const close1 = place({ name: 'eindhoven a', lat: 51.44, lng: 5.48 })
    const close2 = place({ name: 'eindhoven b', lat: 51.45, lng: 5.47 })
    const nowhere = place({ name: 'no point', lat: null, lng: null })
    expect(nearFirst([far, close1, nowhere, close2], { lat: 51.44, lng: 5.47 }).map((p) => p.name)).toEqual(['eindhoven a', 'eindhoven b', 'edegem', 'no point'])
    expect(nearFirst([far, close1], null).map((p) => p.name)).toEqual(['edegem', 'eindhoven a'])
  })
})
