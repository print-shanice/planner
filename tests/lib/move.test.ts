import { beforeByTime, moveChanges } from '../../src/lib/move'
import { trip, stop, cost } from '../factories'
import type { Stop } from '../../src/lib/types'

const top = trip({ id: 'tk', start_date: '2025-09-18', end_date: '2025-09-26' })
const side = trip({ id: 'kama', parent_id: 'tk', start_date: '2025-09-24', end_date: '2025-09-24' })
const trips = [top, side]
const A = '2025-09-21', B = '2025-09-22'
const on = (id: string, day: string | null, time: string | null, position: number, more: Partial<Stop> = {}) => stop({ id, trip_id: 'tk', day, time, position, ...more })

const day21 = () => [on('horin', A, '09:00', 0), on('kyle', A, '12:00', 1), on('trefac', A, null, 2), on('aimu', A, '16:00', 3)]
const ctx = (stops: Stop[], costs = [] as ReturnType<typeof cost>[]) => ({ top, trips, stops, costs })

it('moving an untimed line up writes the positions that change, nothing else', () => {
  const stops = day21()
  const out = moveChanges(stops[2], A, 'kyle', ctx(stops))
  expect(out.cleared).toBeNull()
  expect(out.changes).toEqual([{ id: 'trefac', position: 1 }, { id: 'kyle', position: 2 }])
})

it('dropping in place changes nothing', () => {
  const stops = day21()
  expect(moveChanges(stops[2], A, 'aimu', ctx(stops)).changes).toEqual([])
})

it('dropped where its time does not fit, the time (and end time) clears and is reported', () => {
  const stops = day21().map((s) => (s.id === 'aimu' ? { ...s, end_time: '17:00' } : s))
  const out = moveChanges(stops[3], A, 'kyle', ctx(stops))
  expect(out.cleared).toBe('16:00')
  expect(out.changes).toContainEqual({ id: 'aimu', time: null, end_time: null, position: 1 })
})

it('a timed line dropped where it fits keeps its time', () => {
  const stops = day21()
  expect(moveChanges(stops[1], A, 'trefac', ctx(stops)).cleared).toBeNull()
})

it('to another day: day, positions on both days, and the end date keeps its length', () => {
  const stops = [...day21(), on('ginza', B, '17:05', 0), on('flight', A, null, 4, { kind: 'journey', end_date: '2025-09-22' })]
  const out = moveChanges(stops[5], B, null, ctx(stops))
  expect(out.changes).toContainEqual({ id: 'flight', day: B, end_date: '2025-09-23', position: 1 })
  expect(out.cleared).toBeNull()
})

it('the source day closes up behind a line that leaves it', () => {
  const stops = [...day21(), on('ginza', B, '17:05', 0)]
  const out = moveChanges(stops[1], B, 'ginza', ctx(stops))
  expect(out.changes).toContainEqual({ id: 'kyle', day: B, position: 0 })
  expect(out.changes).toContainEqual({ id: 'trefac', position: 1 })
  expect(out.changes).toContainEqual({ id: 'aimu', position: 2 })
  expect(out.changes).toContainEqual({ id: 'ginza', position: 1 })
  expect(out.cleared).toBeNull()
})

it("into a side trip's day it joins the side trip, and its costs follow", () => {
  const stops = day21()
  const out = moveChanges(stops[2], '2025-09-24', null, ctx(stops, [cost({ id: 'c1', stop_id: 'trefac', trip_id: 'tk' })]))
  expect(out.changes).toContainEqual({ id: 'trefac', day: '2025-09-24', trip_id: 'kama', position: 0 })
  expect(out.costs).toEqual([{ id: 'c1', trip_id: 'kama' }])
})

it('an idea scheduled into a spot comes off the ideas list', () => {
  const stops = [...day21(), on('idea', null, null, 0, { saved: true })]
  const out = moveChanges(stops[4], A, 'aimu', ctx(stops))
  expect(out.changes).toContainEqual({ id: 'idea', day: A, saved: false, position: 3 })
  expect(out.changes).toContainEqual({ id: 'aimu', position: 4 })
})

it('a brand-new line (not saved yet) gets its whole place in the day', () => {
  const stops = day21()
  const fresh = on('new', null, null, 0, { title: 'kitakore building' })
  const out = moveChanges(fresh, A, 'aimu', ctx(stops))
  expect(out.moved).toMatchObject({ id: 'new', day: A, position: 3, trip_id: 'tk' })
  expect(out.changes).toContainEqual({ id: 'aimu', position: 4 })
})

it('a line with a time goes in before the first later one; without a time, last', () => {
  const stops = day21()
  expect(beforeByTime(on('new', null, '15:30', 0), A, ctx(stops))).toBe('aimu')
  expect(beforeByTime(on('new', null, '12:00', 0), A, ctx(stops))).toBe('aimu')
  expect(beforeByTime(on('new', null, '08:00', 0), A, ctx(stops))).toBe('horin')
  expect(beforeByTime(on('new', null, null, 0), A, ctx(stops))).toBeNull()
})
