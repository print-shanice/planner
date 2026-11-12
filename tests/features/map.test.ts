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
  // a number means a pin: the note without a place and the flight take none
  expect(byId.a).toMatchObject({ number: 1, color: 'var(--g0)' })
  expect(byId.b).toMatchObject({ number: 2, color: 'var(--g0)' })
  expect(byId.c).toMatchObject({ number: 1, color: 'var(--g0)' })
  expect(byId.n).toBeUndefined()
  expect(byId.j).toBeUndefined()
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

it("a side trip's day takes the side trip's colour", () => {
  const ex = trip({ id: 'ex', start_date: '2027-02-01', end_date: '2027-02-28', color: 5 })
  const kid = trip({ id: 'lap2', parent_id: 'ex', start_date: '2027-02-07', end_date: '2027-02-11', color: 1 })
  const stops = [stop({ id: 'k', trip_id: 'lap2', day: '2027-02-08', place: at(66.6, 25.9) })]
  const out = mapFeatures(ex, [ex, kid], stops, '2027-02-08')
  expect(out.pins.features[0].properties.color).toBe('var(--g1)')
})

it("a journey's two ends are dots, never a numbered pin", () => {
  const { trips, stops } = setup()
  const { ends } = mapFeatures(lap, trips, stops, 'all')
  expect(ends.features.map((f) => f.properties.id)).toEqual(['j', 'j'])
  expect(ends.features.map((f) => f.geometry.coordinates)).toEqual([[5.37, 51.45], [25.83, 66.56]])
})

it("tonight's bed is drawn for a day", () => {
  const { trips, stops } = setup()
  const bed = stop({ id: 'bed', trip_id: 'lap', kind: 'stay', title: 'Hotel', day: '2027-02-06', end_date: '2027-02-09', place: at(66.5, 25.72) })
  const all = [...stops, bed]
  const out = mapFeatures(lap, trips, all, '2027-02-07')
  expect(out.beds.features.map((f) => f.properties.id)).toEqual(['bed'])
})

it('the whole trip draws every stay once, named, so a hotel is never missing from the map', () => {
  const { trips, stops } = setup()
  const hotel = stop({ id: 'bed', trip_id: 'lap', kind: 'stay', title: 'Hop Inn', day: '2027-02-06', end_date: '2027-02-09', place: at(66.5, 25.72) })
  const later = stop({ id: 'bed2', trip_id: 'lap', kind: 'stay', title: 'Ryokan', day: '2027-02-09', end_date: '2027-02-11', place: at(66.7, 25.9) })
  const unlocated = stop({ id: 'bed3', trip_id: 'lap', kind: 'stay', title: 'Somewhere', day: '2027-02-11', place: null })
  const out = mapFeatures(lap, trips, [...stops, hotel, later, unlocated], 'all')
  expect(out.beds.features.map((f) => f.properties.id)).toEqual(['bed', 'bed2'])
  expect(out.names.features.map((f) => f.properties.name)).toEqual(expect.arrayContaining(['hop inn', 'ryokan']))
  // stays are never numbered
  expect(out.pins.features.map((f) => f.properties.id)).not.toContain('bed')
})

it('names sit beside pins, ends and the bed, lowercased', () => {
  const { trips, stops } = setup()
  const named = [
    ...stops,
    stop({ id: 'ark', trip_id: 'lap', title: 'Arktikum', day: '2027-02-07', position: 5, place: at(66.51, 25.73) }),
    stop({ id: 'bed', trip_id: 'lap', kind: 'stay', title: 'Hotel Nova', day: '2027-02-06', end_date: '2027-02-09', place: at(66.5, 25.72) }),
  ]
  const j = named.find((s) => s.id === 'j')!
  j.origin = { ...at(51.45, 5.37), name: 'Eindhoven Airport' } as Stop['origin']
  j.destination = { ...at(66.56, 25.83), name: 'Rovaniemi Airport' } as Stop['destination']
  const names = mapFeatures(lap, trips, named, '2027-02-07').names.features.map((f) => f.properties.name)
  expect(names).toEqual(expect.arrayContaining(['arktikum', 'hotel nova', 'eindhoven airport', 'rovaniemi airport']))
})

it("ideas within 10 km of the day show, far ones don't", () => {
  const ex = trip({ id: 'ex', start_date: '2027-02-01', end_date: '2027-02-28', color: 5 })
  const kid = trip({ id: 'lap2', parent_id: 'ex', start_date: '2027-02-07', end_date: '2027-02-11', color: 1 })
  const stops = [
    stop({ id: 'p', trip_id: 'lap2', day: '2027-02-08', place: at(66.5, 25.7) }),
    stop({ id: 'near', trip_id: 'lap2', day: null, saved: true, place: at(66.545, 25.7) }),
    stop({ id: 'far', trip_id: 'lap2', day: null, saved: true, place: at(66.86, 25.7) }),
    stop({ id: 'parent', trip_id: 'ex', day: null, saved: false, place: at(66.5, 25.75) }),
  ]
  const out = mapFeatures(ex, [ex, kid], stops, '2027-02-08')
  expect(out.saved.features.map((f) => f.properties.id).sort()).toEqual(['near', 'parent'])
})

it('an idea already on the day is not shown twice', () => {
  const stops = [stop({ id: 'x', trip_id: 'lap', day: '2027-02-08', saved: true, place: at(66.6, 25.9) })]
  const out = mapFeatures(lap, [lap], stops, '2027-02-08')
  expect(out.pins.features.map((f) => f.properties.id)).toEqual(['x'])
  expect(out.saved.features).toEqual([])
})

it('a blank or missing name draws no name', () => {
  const blank = [
    stop({ id: 'x', trip_id: 'lap', title: '', day: '2027-02-07', position: 0, place: { ...at(66.5, 25.7), name: '  ' } }),
    stop({ id: 'jj', trip_id: 'lap', kind: 'journey', title: '', day: '2027-02-07', position: 1, origin: { ...at(66.51, 25.7), name: undefined } as unknown as Stop['origin'], destination: { ...at(66.6, 25.9), name: 'Kemi' } }),
  ] as Stop[]
  const names = mapFeatures(lap, [lap], blank, '2027-02-07').names.features.map((f) => f.properties.name)
  expect(names).toEqual(['kemi'])
})
