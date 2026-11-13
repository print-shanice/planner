import { dayLegs, tonightsBed, mapBed } from '../../src/lib/legs'
import type { DayEntry } from '../../src/lib/dates'
import { stop, place } from '../factories'

const at = (n: number) => place({ lat: 52 + n * 0.01, lng: 5 })
const spot = (id: string, n: number) => stop({ id, place: at(n) })
const e = (s: ReturnType<typeof stop>, kind: DayEntry['kind'] = 'stop'): DayEntry => ({ kind, stop: s })
const ids = (l: ReturnType<typeof dayLegs>) => l.map((x) => `${x.from.id}>${x.to.id}`)

it('a leg joins each pair of located entries in order', () => {
  const legs = dayLegs([e(spot('A', 0)), e(spot('B', 1)), e(spot('C', 2))])
  expect(ids(legs)).toEqual(['A>B', 'B>C'])
  expect(legs.some((l) => l.evening)).toBe(false)
})

it('an unlocated line is jumped over', () => {
  expect(ids(dayLegs([e(spot('A', 0)), e(stop({ id: 'N', place: null })), e(spot('B', 1))]))).toEqual(['A>B'])
})

it('a journey starts at its origin and leaves you at its destination', () => {
  const J = stop({ id: 'J', kind: 'journey', origin: at(1), destination: at(2) })
  const legs = dayLegs([e(spot('A', 0)), e(J), e(spot('B', 3))])
  expect(ids(legs)).toEqual(['A>J', 'J>B'])
  expect(legs[0].b).toBe(J.origin)
  expect(legs[1].a).toBe(J.destination)
})

it('two points under 150 m apart get no leg', () => {
  expect(dayLegs([e(spot('A', 0)), e(stop({ id: 'B', place: place({ lat: 52.0005, lng: 5 }) }))])).toEqual([])
})

it('the morning bed leads to the first stop', () => {
  const legs = dayLegs([e(spot('S', 0), 'staying'), e(spot('A', 1))])
  expect(ids(legs)[0]).toBe('S>A')
  expect(legs[0].fromKind).toBe('staying')
})

it("the evening leg goes back to tonight's bed", () => {
  const legs = dayLegs([e(spot('S', 0), 'staying'), e(spot('A', 1)), e(spot('B', 2))])
  const last = legs[legs.length - 1]
  expect(ids([last])).toEqual(['B>S'])
  expect(last.evening).toBe(true)
})

it('no evening leg when the day ends at the check-in', () => {
  const legs = dayLegs([e(spot('A', 0)), e(spot('S', 1), 'checkin')])
  expect(ids(legs)).toEqual(['A>S'])
  expect(legs.some((l) => l.evening)).toBe(false)
})

it('no leg from the bed to itself on a day with no stops', () => {
  expect(dayLegs([e(spot('S', 0), 'staying')])).toEqual([])
})

it('nothing to pair', () => {
  expect(dayLegs([e(stop({ place: null }))])).toEqual([])
  expect(dayLegs([e(spot('A', 0))])).toEqual([])
})

it("tonight's bed and the map's bed", () => {
  const X = spot('X', 0), Y = spot('Y', 1)
  expect(tonightsBed([e(X, 'checkout'), e(Y, 'checkin')])).toBe(Y)
  expect(mapBed([e(X, 'checkout'), e(Y, 'checkin')])).toBe(Y)
  expect(tonightsBed([e(X, 'checkout')])).toBeNull()
  expect(mapBed([e(X, 'checkout')])).toBe(X)
})

it('a journey with only a destination leaves you there', () => {
  const J = stop({ id: 'J', kind: 'journey', origin: null, destination: at(2) })
  const legs = dayLegs([e(spot('A', 0)), e(J), e(spot('B', 3))])
  expect(ids(legs)).toEqual(['J>B'])
  expect(legs[0].a).toBe(J.destination)
})

it("a side trip's last day starts at the bed you woke in, never a leg into the parent's room", () => {
  const room = spot('room', 0), hostel = stop({ id: 'hostel', place: place({ lat: 66.5, lng: 25.7 }) })
  const A = stop({ id: 'A', place: place({ lat: 66.6, lng: 25.8 }) })
  const legs = dayLegs([e(room, 'staying'), e(hostel, 'checkout'), e(A)])
  expect(ids(legs)).toEqual(['hostel>A', 'A>room'])
  expect(legs[0].fromKind).toBe('checkout')
  // the order the day sorts them in (checkout before staying)
  expect(ids(dayLegs([e(hostel, 'checkout'), e(room, 'staying'), e(A)]))).toEqual(['hostel>A', 'A>room'])
})
