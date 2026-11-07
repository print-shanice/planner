import { mapFeatures } from '../../src/features/map/features'
import { trip, stop, place } from '../factories'
import type { Stop, Trip } from '../../src/lib/types'

const lap = trip({ id: 'lap', start_date: '2027-02-07', end_date: '2027-02-11' })
const at = (lat: number, lng: number) => place({ lat, lng })

function setup() {
  const stops = [
    stop({ id: 'a', trip_id: 'lap', day: '2027-02-07', position: 0, place: at(66.5, 25.7) }),
    stop({ id: 'n', trip_id: 'lap', kind: 'note', day: '2027-02-07', position: 1, place: null }),
    stop({ id: 'b', trip_id: 'lap', day: '2027-02-07', position: 2, place: at(66.54, 25.84) }),
    stop({ id: 'c', trip_id: 'lap', day: '2027-02-08', position: 0, place: at(66.6, 25.9) }),
    stop({ id: 'sv', trip_id: 'lap', day: null, saved: true, place: at(66.4, 25.6) }),
    stop({ id: 'j', trip_id: 'lap', kind: 'journey', mode: 'flight', day: '2027-02-07', position: 3, origin: at(51.45, 5.37), destination: at(66.56, 25.83) }),
  ] as Stop[]
  return { trips: [lap] as Trip[], stops }
}

it('pins carry the plan numbers and day colours', () => {
  const { trips, stops } = setup()
  const { pins } = mapFeatures(lap, trips, stops, 'all')
  const byId = Object.fromEntries(pins.features.map((f) => [f.properties.id, f.properties]))
  expect(byId.a).toMatchObject({ number: 1, color: 'var(--g0)' })
  expect(byId.b).toMatchObject({ number: 3, color: 'var(--g0)' })
  expect(byId.c).toMatchObject({ number: 1, color: 'var(--g0)' })
  expect(byId.n).toBeUndefined()
  expect(pins.features.find((f) => f.properties.id === 'a')!.geometry.coordinates).toEqual([25.7, 66.5])
})

it('each day gets one line through its located stops', () => {
  const { trips, stops } = setup()
  const { lines } = mapFeatures(lap, trips, stops, 'all')
  const day = lines.features.filter((f) => f.properties.kind === 'day')
  expect(day).toHaveLength(1)
  expect(day[0].geometry.coordinates).toEqual([[25.7, 66.5], [25.84, 66.54]])
  expect(day[0].properties.color).toBe('var(--g0)')
})

it('filter by day keeps only that day', () => {
  const { trips, stops } = setup()
  const out = mapFeatures(lap, trips, stops, '2027-02-08')
  expect(out.pins.features.map((f) => f.properties.id)).toEqual(['c'])
  expect(out.lines.features).toEqual([])
  expect(out.saved.features).toEqual([])
})

it('saved places are separate from day pins', () => {
  const { trips, stops } = setup()
  const all = mapFeatures(lap, trips, stops, 'all')
  expect(all.saved.features.map((f) => f.properties.id)).toEqual(['sv'])
  expect(all.pins.features.map((f) => f.properties.id)).not.toContain('sv')
  const only = mapFeatures(lap, trips, stops, 'saved')
  expect(only.pins.features).toEqual([])
  expect(only.saved.features).toHaveLength(1)
})

it('a journey becomes a line with its mode', () => {
  const { trips, stops } = setup()
  const j = mapFeatures(lap, trips, stops, 'all').lines.features.find((f) => f.properties.kind === 'journey')!
  expect(j.properties.mode).toBe('flight')
  expect(j.geometry.coordinates).toEqual([[5.37, 51.45], [25.83, 66.56]])
})

it('side trips are on the parent map', () => {
  const eu = trip({ id: 'eu', start_date: '2027-02-01', end_date: '2027-02-28' })
  const kid = { ...lap, parent_id: 'eu' }
  const { stops } = setup()
  const out = mapFeatures(eu, [eu, kid], stops, 'all')
  expect(out.pins.features.find((f) => f.properties.id === 'a')!.properties.color).toBe('var(--g0)')
  expect(out.pins.features).toHaveLength(3)
})
