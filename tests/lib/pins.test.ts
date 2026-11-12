import { pinNumbers } from '../../src/lib/pins'
import { stop, place } from '../factories'
import type { DayEntry } from '../../src/lib/dates'

const e = (s: ReturnType<typeof stop>, kind: DayEntry['kind'] = 'stop'): DayEntry => ({ kind, stop: s })

it('only lines with a spot on the map get a number, counted top to bottom', () => {
  const entries = [
    e(stop({ id: 'horin', place: place() })),
    e(stop({ id: 'tozai', kind: 'journey', title: 'tozai line to nakano' })),
    e(stop({ id: 'flight', kind: 'journey', origin: place(), destination: place() })),
    e(stop({ id: 'trefac', place: { name: 'trefac', lat: null, lng: null } })),
    e(stop({ id: 'walk', kind: 'note', title: 'walk to dinner' })),
    e(stop({ id: 'bed', kind: 'stay', place: place() }), 'checkin'),
    e(stop({ id: 'kyle', place: place() })),
  ]
  expect([...pinNumbers(entries)]).toEqual([['horin', 1], ['kyle', 2]])
})

it('a note pinned to a place counts like a place', () => {
  expect([...pinNumbers([e(stop({ id: 'n', kind: 'note', place: place() }))])]).toEqual([['n', 1]])
})
