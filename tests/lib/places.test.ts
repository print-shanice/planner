import { describe, expect, it } from 'vitest'
import { kindsIn, sameAs, tripPlaces } from '../../src/lib/places'
import { place, stop, trip } from '../factories'

const top = trip({ id: 'eu', start_date: '2027-06-01', end_date: '2027-06-30' })
const side = trip({ id: 'prg', parent_id: 'eu', start_date: '2027-06-05', end_date: '2027-06-08' })
const trips = [top, side, trip({ id: 'jp' })]

describe('a trip\'s places', () => {
  it('every place in the trip and its side trips, planned or not; not-yet-planned first, then by day', () => {
    const stops = [
      stop({ id: 'late', trip_id: 'eu', day: '2027-06-20' }),
      stop({ id: 'idea', trip_id: 'prg', day: null }),
      stop({ id: 'early', trip_id: 'prg', day: '2027-06-06' }),
      stop({ id: 'note', trip_id: 'eu', kind: 'note', day: null }),
      stop({ id: 'stay', trip_id: 'eu', kind: 'stay', day: '2027-06-01' }),
      stop({ id: 'loose-stay', trip_id: 'eu', kind: 'stay', day: null }),
      stop({ id: 'far', trip_id: 'jp', day: null }),
    ]
    expect(tripPlaces(top, trips, stops).map((s) => s.id)).toEqual(['idea', 'loose-stay', 'early', 'late'])
  })
})

describe('the same place twice', () => {
  const kafka = stop({ id: 'k', trip_id: 'prg', title: 'café kafka', place: place({ name: 'Café Kafka', lat: 50.087, lng: 14.42, gid: 'g-kafka' }) })
  const named = stop({ id: 'n', trip_id: 'eu', title: 'the rooftop bar', place: null })

  it('is the same google place', () => {
    expect(sameAs({ title: 'x', place: place({ name: 'other words', lat: 1, lng: 1, gid: 'g-kafka' }) }, [kafka])?.id).toBe('k')
  })

  it('is the same name close by, with no case or accents', () => {
    expect(sameAs({ title: 'Cafe Kafka', place: place({ name: 'Cafe Kafka', lat: 50.0872, lng: 14.4201 }) }, [kafka])?.id).toBe('k')
  })

  it('a chain with the same name somewhere else is not the same', () => {
    expect(sameAs({ title: 'café kafka', place: place({ name: 'café kafka', lat: 48.2, lng: 16.37 }) }, [kafka])).toBeNull()
  })

  it('a name without a spot matches the same name', () => {
    expect(sameAs({ title: 'The Rooftop Bar', place: null }, [named])?.id).toBe('n')
    expect(sameAs({ title: 'café kafka', place: null }, [kafka])?.id).toBe('k')
  })

  it('a different place is not the same', () => {
    expect(sameAs({ title: 'louvre', place: place({ name: 'louvre', lat: 48.86, lng: 2.33 }) }, [kafka, named])).toBeNull()
  })
})

describe('kinds to filter by', () => {
  it('the kinds that are there, in the usual order, with counts; unknown kinds are "other", last', () => {
    const stops = [
      stop({ category: 'restaurant' }), stop({ category: 'cafe' }), stop({ category: 'restaurant' }), stop({ category: null }),
    ]
    expect(kindsIn(stops)).toEqual([['cafe', 1], ['restaurant', 2], ['other', 1]])
  })
})
