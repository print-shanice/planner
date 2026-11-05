import { clashes } from '../../src/lib/clash'
import { countryStatus, tripsInCountry, homeTotals, ancestors, descendants } from '../../src/lib/countries'
import { trip, stop, place } from '../factories'

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
      stop({ trip_id: 'past', place: place({ country: 'jp' }) }),
      stop({ trip_id: 'fut', place: place({ country: 'FI' }) }),
      stop({ trip_id: 'fut', kind: 'journey', origin: place({ country: 'NL' }), destination: place({ country: 'FI' }) }),
    ], '2026-11-05')
    expect(s.get('JP')).toBe('been')
    expect(s.get('FI')).toBe('planned')
    expect(s.get('NL')).toBe('planned')
  })

  it('been wins over planned for the same country', () => {
    const s = countryStatus([past, future], [
      stop({ trip_id: 'past', place: place({ country: 'JP' }) }),
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

  it('home totals', () => {
    const p = trip({ id: 'p' })
    const c = trip({ id: 'c', parent_id: 'p' })
    expect(homeTotals([p, c], [
      stop({ trip_id: 'c', place: place({ name: 'arktikum', city: 'rovaniemi', country: 'FI' }) }),
      stop({ trip_id: 'c', place: place({ name: 'santa claus village', city: 'Rovaniemi', country: 'FI' }) }),
      stop({ trip_id: 'p', place: place({ name: 'acropolis', city: 'athens', country: 'GR' }) }),
    ])).toEqual({ countries: 2, cities: 2, trips: 2 })
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
