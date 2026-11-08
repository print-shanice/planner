import { hasSideTrips, overviewFeatures } from '../../src/features/map/overview'
import { fmtRange } from '../../src/lib/dates'
import { place, stop, trip } from '../factories'

const ex = trip({ id: 'ex', name: 'Exchange', base: place({ name: 'Eindhoven', city: 'Eindhoven', lat: 51.4, lng: 5.5 }), start_date: '2027-01-28', end_date: '2027-07-13' })
const lap = trip({ id: 'lap', parent_id: 'ex', name: 'Lapland', start_date: '2027-02-07', end_date: '2027-02-11', color: 1, base: place({ name: 'Rovaniemi', lat: 66.5, lng: 25.7 }) })
const ath = trip({ id: 'ath', parent_id: 'ex', name: 'Athens', start_date: '2027-03-01', end_date: '2027-03-04', color: 2 })
const trips = [ex, lap, ath]

it('a trip with side trips gets one pin per side trip', () => {
  const stops = [
    stop({ trip_id: 'ath', place: place({ lat: 38, lng: 23 }) }),
    stop({ trip_id: 'ath', place: place({ lat: 40, lng: 25 }) }),
  ]
  const o = overviewFeatures(ex, trips, stops)
  expect(o.home?.name).toBe('eindhoven')
  expect(o.sides.map((s) => s.id)).toEqual(['lap', 'ath'])
  expect(o.sides[0]).toEqual({ id: 'lap', name: 'lapland', dates: fmtRange('2027-02-07', '2027-02-11'), color: 'var(--g1)', at: [25.7, 66.5] })
  expect(o.sides[1].at).toEqual([24, 39])
  expect(o.lines.features).toHaveLength(2)
  expect(o.lines.features[0].properties).toEqual({ kind: 'spoke', color: 'var(--ink-3)', day: null })
})

it('a side trip with nothing located has no pin but stays listed', () => {
  const o = overviewFeatures(ex, trips, [])
  expect(o.sides.find((s) => s.id === 'ath')?.at).toBeNull()
  expect(o.lines.features).toHaveLength(1)
})

it('no base, no spokes', () => {
  const o = overviewFeatures({ ...ex, base: null }, trips, [])
  expect(o.home).toBeNull()
  expect(o.lines.features).toHaveLength(0)
})

it('side trips of side trips are not drawn', () => {
  const deep = trip({ id: 'deep', parent_id: 'lap', name: 'Deep' })
  expect(overviewFeatures(ex, [...trips, deep], []).sides.map((s) => s.id)).not.toContain('deep')
})

it('hasSideTrips', () => {
  expect(hasSideTrips(ex, trips)).toBe(true)
  expect(hasSideTrips(lap, trips)).toBe(false)
})
