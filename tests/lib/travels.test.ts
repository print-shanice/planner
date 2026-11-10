import { describe, expect, it } from 'vitest'
import { arc, aroundTheWorld, favourites, stamps, tickets, km } from '../../src/lib/travels'
import { place, stop, trip } from '../factories'
import type { Review, Stop } from '../../src/lib/types'

const TODAY = '2027-03-01'
const ein = place({ name: 'eindhoven', city: 'eindhoven', country: 'NL', lat: 51.44, lng: 5.48 })
const rvn = place({ name: 'rovaniemi', city: 'rovaniemi', country: 'FI', lat: 66.5, lng: 25.73 })
const par = place({ name: 'paris nord', city: 'paris', country: 'FR', lat: 48.88, lng: 2.35 })

const journey = (o: Partial<Stop>) => stop({ kind: 'journey', origin: ein, destination: rvn, mode: 'flight', ...o })

describe('km', () => {
  it('measures straight lines over the earth', () => {
    expect(Math.round(km([5.48, 51.44], [25.73, 66.5]))).toBeGreaterThan(1990)
    expect(Math.round(km([5.48, 51.44], [25.73, 66.5]))).toBeLessThan(2030)
    expect(km([0, 0], [0, 0])).toBe(0)
  })
})

describe('tickets', () => {
  it('counts journeys that have happened by kind, each with its route and day', () => {
    const t = trip({ id: 'ex', start_date: '2027-01-28', end_date: '2027-07-13' })
    const stops = [
      journey({ id: 'f1', trip_id: 'ex', day: '2027-02-07' }),
      journey({ id: 'f2', trip_id: 'ex', day: '2027-02-11', origin: rvn, destination: ein }),
      journey({ id: 'tr', trip_id: 'ex', day: '2027-02-19', mode: 'train', destination: par }),
      journey({ id: 'bus', trip_id: 'ex', day: '2027-02-20', mode: 'bus', origin: par, destination: ein }),
      journey({ id: 'later', trip_id: 'ex', day: '2027-04-01' }),
      journey({ id: 'nomode', trip_id: 'ex', day: '2027-02-21', mode: null }),
      stop({ id: 'cafe', trip_id: 'ex', day: '2027-02-08', place: rvn }),
    ]
    const r = tickets([t], stops, TODAY)
    expect(r.flights.map((x) => [x.id, x.from, x.to, x.day])).toEqual([['f1', 'eindhoven', 'rovaniemi', '2027-02-07'], ['f2', 'rovaniemi', 'eindhoven', '2027-02-11']])
    expect(r.trains.map((x) => x.id)).toEqual(['tr'])
    expect(r.ground.map((x) => x.id)).toEqual(['bus'])
    expect(r.flights[0].line).toEqual([[5.48, 51.44], [25.73, 66.5]])
    // every journey that happened adds its distance, typed or not
    expect(Math.round(r.km)).toBe(Math.round(km([5.48, 51.44], [25.73, 66.5]) * 2 + km([5.48, 51.44], [2.35, 48.88]) * 2 + km([5.48, 51.44], [25.73, 66.5])))
  })

  it('a journey without coordinates still counts, without a line or distance', () => {
    const r = tickets([trip({ id: 'x' })], [journey({ trip_id: 'x', day: '2027-02-07', origin: { name: 'somewhere', lat: null, lng: null }, destination: rvn })], TODAY)
    expect(r.flights).toHaveLength(1)
    expect(r.flights[0].line).toBeNull()
    expect(r.km).toBe(0)
  })
})

describe('arc', () => {
  it('bends a flight over the earth: it starts and ends at the two places, with points between', () => {
    const pts = arc([5.48, 51.44], [139.7, 35.7])
    expect(pts[0]).toEqual([5.48, 51.44])
    expect(pts[pts.length - 1]).toEqual([139.7, 35.7])
    expect(pts.length).toBeGreaterThan(8)
    // a great circle from europe to japan goes north of the straight line
    const mid = pts[Math.floor(pts.length / 2)]
    expect(mid[1]).toBeGreaterThan(60)
  })

  it('a short hop is still a line from a to b', () => {
    const pts = arc([5.48, 51.44], [5.5, 51.5])
    expect(pts[0]).toEqual([5.48, 51.44])
    expect(pts[pts.length - 1]).toEqual([5.5, 51.5])
    expect(pts.every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))).toBe(true)
  })
})

describe('aroundTheWorld', () => {
  it('says how far round the earth the distance goes', () => {
    expect(aroundTheWorld(0)).toBe('')
    expect(aroundTheWorld(2000)).toBe('5% of the way round the world')
    expect(aroundTheWorld(8420)).toBe('about a fifth of the way round the world')
    expect(aroundTheWorld(20000)).toBe('about half the way round the world')
    expect(aroundTheWorld(52000)).toBe('1.3 times round the world')
  })
})

describe('stamps', () => {
  it('one per country you have been to, dated the day you first arrived, in that trip\'s colour', () => {
    const ex = trip({ id: 'ex', start_date: '2027-01-28', end_date: '2027-07-13', base: ein, color: 0 })
    const lap = trip({ id: 'lap', parent_id: 'ex', start_date: '2027-02-07', end_date: '2027-02-11', color: 1 })
    const stops = [
      stop({ trip_id: 'lap', day: '2027-02-08', place: rvn }),
      stop({ trip_id: 'lap', day: '2027-02-07', place: { ...rvn, name: 'airport' } }),
      stop({ trip_id: 'ex', day: '2027-05-02', place: par }),
    ]
    expect(stamps([ex, lap], stops, TODAY)).toEqual([
      { code: 'NL', name: 'netherlands', first: '2027-01-28', color: 0, tripId: 'ex', port: 'eindhoven', mode: null },
      { code: 'FI', name: 'finland', first: '2027-02-07', color: 1, tripId: 'lap', port: null, mode: null },
    ])
  })

  it('a stamp carries how you arrived and where: the first journey into the country', () => {
    const ex = trip({ id: 'ex', start_date: '2027-01-28', end_date: '2027-07-13', base: ein, color: 0 })
    const stops = [
      stop({ trip_id: 'ex', kind: 'journey', mode: 'flight', day: '2027-01-28', origin: { name: 'changi', address: '', country: 'SG', lat: 1.36, lng: 103.99 }, destination: { name: 'Schiphol', address: '', city: 'Amsterdam', country: 'nl', lat: 52.31, lng: 4.76 } }),
      stop({ trip_id: 'ex', kind: 'journey', mode: 'train', day: '2027-01-28', origin: { name: 'schiphol', address: '', country: 'NL', lat: 52.31, lng: 4.76 }, destination: ein }),
    ]
    expect(stamps([ex], stops, TODAY).find((s) => s.code === 'NL')).toMatchObject({ port: 'schiphol', mode: 'flight' })
  })
})

describe('favourites', () => {
  const r = (o: Partial<Review>): Review => ({ id: Math.random().toString(), stop_id: 's', author_id: 'u1', rating: null, return_choice: null, outcome: 'done', comments: '', ...o })
  it('5 stars first, then 4 stars you would go back to, each place once with its best rating', () => {
    const t = trip({ id: 'lap', color: 1 })
    const stops = [
      stop({ id: 'ark', trip_id: 'lap', title: 'arktikum', day: '2027-02-08', place: rvn }),
      stop({ id: 'cafe', trip_id: 'lap', title: 'cafe', day: '2027-02-09', place: rvn }),
      stop({ id: 'meh', trip_id: 'lap', title: 'meh', day: '2027-02-09', place: rvn }),
      stop({ id: 'ok', trip_id: 'lap', title: 'ok place', day: '2027-02-10', place: par }),
    ]
    const reviews = [
      r({ stop_id: 'cafe', rating: 4, return_choice: 'yes' }),
      r({ stop_id: 'ark', rating: 4, author_id: 'u1' }),
      r({ stop_id: 'ark', rating: 5, author_id: 'u2' }),
      r({ stop_id: 'meh', rating: 3, return_choice: 'yes' }),
      r({ stop_id: 'ok', rating: 4, return_choice: 'maybe' }),
      r({ stop_id: 'gone', rating: 5 }),
    ]
    expect(favourites([t], stops, reviews).map((f) => [f.stop.id, f.rating, f.back, f.code, f.color])).toEqual([
      ['ark', 5, false, 'FI', 1],
      ['cafe', 4, true, 'FI', 1],
    ])
  })
})
