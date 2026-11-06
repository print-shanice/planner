import { clashPairs, clashes } from '../../src/lib/clash'
import { trip, stop } from '../factories'

const eu = trip({ id: 'eu', name: 'euro summer', start_date: '2027-06-01', end_date: '2027-07-01' })
const rome = trip({ id: 'rome', parent_id: 'eu', name: 'rome', start_date: '2027-06-12', end_date: '2027-06-16' })
const flo = trip({ id: 'flo', parent_id: 'eu', name: 'florence', start_date: '2027-06-14', end_date: '2027-06-18' })

it('overlapping side trips are a named pair with the shared dates, earliest first', () => {
  expect(clashPairs([eu, flo, rome], [])).toEqual([
    { kind: 'trip', a: { id: 'rome', name: 'rome', tripId: 'rome' }, b: { id: 'flo', name: 'florence', tripId: 'flo' }, from: '2027-06-14', to: '2027-06-16' },
  ])
})

it('side trips that only touch do not clash', () => {
  const next = trip({ id: 'nx', parent_id: 'eu', name: 'naples', start_date: '2027-06-16', end_date: '2027-06-20' })
  expect(clashPairs([eu, rome, next], [])).toEqual([])
})

it('overlapping stays name the stays, falling back to the place', () => {
  const a = stop({ id: 'h1', trip_id: 'eu', kind: 'stay', title: '', place: { name: 'hotel roma', lat: null, lng: null }, day: '2027-06-03', end_date: '2027-06-06' })
  const b = stop({ id: 'h2', trip_id: 'eu', kind: 'stay', title: 'casa', day: '2027-06-05', end_date: '2027-06-08' })
  expect(clashPairs([eu], [b, a])).toEqual([
    { kind: 'stay', a: { id: 'h1', name: 'hotel roma', tripId: 'eu' }, b: { id: 'h2', name: 'casa', tripId: 'eu' }, from: '2027-06-05', to: '2027-06-06' },
  ])
})

it('clashes still lists every id involved', () => {
  expect([...clashes([eu, rome, flo], [])].sort()).toEqual(['flo', 'rome'])
})
