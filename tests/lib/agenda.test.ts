import { agendaForDay, validDay, samePlace } from '../../src/lib/agenda'
import { trip, stop, place } from '../factories'
import { mapFeatures } from '../../src/features/map/features'

it('map pins use the combined chronological agenda numbers', () => {
  const p = trip({ id: 'p' }), c = trip({ id: 'c', parent_id: 'p' })
  const stops = [stop({ id: 'late', trip_id: 'p', day: '2027-06-12', time: '14:00', place: place() }),
    stop({ id: 'early', trip_id: 'c', day: '2027-06-12', time: '09:00', place: place() })]
  expect(mapFeatures(p, [p, c], stops, '2027-06-12').pins.features.map(f => [f.properties.id, f.properties.number])).toEqual([['early', 1], ['late', 2]])
})

it('includes parent and nested plans without unrelated trips, with time ordering', () => {
  const parent = trip({ id: 'p' }), child = trip({ id: 'c', parent_id: 'p' }), nested = trip({ id: 'n', parent_id: 'c' })
  const entries = agendaForDay(parent, [parent, child, nested], [
    stop({ id: 'a', trip_id: 'p', day: '2027-06-12', time: '14:00' }),
    stop({ id: 'b', trip_id: 'n', day: '2027-06-12', time: '09:00' }),
    stop({ id: 'c', trip_id: 'c', day: '2027-06-12', time: null }),
    stop({ id: 'x', trip_id: 'other', day: '2027-06-12' }),
  ], '2027-06-12')
  expect(entries.map(e => e.stop?.id)).toEqual(['b', 'a', 'c'])
})
it('retains ongoing accommodation on a previously empty long-trip day', () => {
  const t = trip({ id: 'p' })
  const s = stop({ trip_id: 'p', kind: 'stay', day: '2027-01-01', end_date: '2027-07-01' })
  expect(agendaForDay(t, [t], [s], '2027-04-12')).toEqual([{ kind: 'staying', stop: s }])
  expect(agendaForDay(t, [t], [], '2027-04-12')).toEqual([])
})
it('rejects impossible dates and does not match places by name alone', () => {
  expect(validDay('2027-02-30')).toBe(false)
  expect(validDay('2027-02-28')).toBe(true)
  expect(validDay('oops')).toBe(false)
  expect(samePlace(place({ osm_id: 'node:1' }), place({ osm_id: 'node:1' }))).toBe(true)
  expect(samePlace(place({ lat: null, lng: null }), place({ lat: null, lng: null }))).toBe(false)
})
