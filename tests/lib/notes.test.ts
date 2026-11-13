import { describe, expect, it } from 'vitest'
import { tripNotes, undatedPlaces } from '../../src/lib/notes'
import { stop, trip } from '../factories'
import type { Link } from '../../src/lib/types'

const top = trip({ id: 'eu', name: 'euro summer', start_date: '2027-06-01', end_date: '2027-06-30' })
const side = trip({ id: 'prg', parent_id: 'eu', name: 'prague', start_date: '2027-06-05', end_date: '2027-06-08' })
const other = trip({ id: 'jp', name: 'japan' })
const trips = [top, side, other]
const link = (o: Partial<Link>): Link => ({ id: 'l', trip_id: 'eu', url: 'https://example.com', title: '', note: '', ...o })

describe('a trip\'s notes', () => {
  it('collects note lines and the notes written on places, stays and journeys, across side trips', () => {
    const stops = [
      stop({ id: 'n', trip_id: 'eu', kind: 'note', title: 'ask about the landlord', day: null }),
      stop({ id: 'f', trip_id: 'prg', kind: 'journey', title: 'ams to prg', day: '2027-06-05', notes: 'bring the visa printout' }),
      stop({ id: 'h', trip_id: 'prg', kind: 'stay', title: 'hotel u zlatého', day: '2027-06-05', end_date: '2027-06-08', notes: 'late check-in, call ahead' }),
      stop({ id: 'quiet', trip_id: 'eu', kind: 'place', title: 'café without notes', day: '2027-06-02' }),
      stop({ id: 'far', trip_id: 'jp', kind: 'note', title: 'not this trip', day: null }),
    ]
    const n = tripNotes(top, trips, stops, [])
    expect(n.undated.map((x) => x.key)).toEqual(['stop:n'])
    expect(n.days.map((d) => [d.date, d.items.map((x) => x.key)])).toEqual([['2027-06-05', ['stop:f', 'stop:h']]])
  })

  it('says what each note is on and keeps the note itself', () => {
    const stops = [stop({ id: 'f', trip_id: 'eu', kind: 'journey', title: 'ams to prg', day: '2027-06-05', notes: 'bring the visa printout' })]
    const [item] = tripNotes(top, trips, stops, []).days[0].items
    expect(item).toMatchObject({ kind: 'stop', title: 'ams to prg', text: 'bring the visa printout', date: '2027-06-05' })
  })

  it('a note line is its title and its words', () => {
    const stops = [stop({ id: 'n', trip_id: 'eu', kind: 'note', title: 'castle tour', notes: 'meet at the gate', day: '2027-06-07' })]
    expect(tripNotes(top, trips, stops, []).days[0].items[0]).toMatchObject({ kind: 'note', title: 'castle tour', text: 'meet at the gate' })
  })

  it('a day reads in the plan\'s order: times decide', () => {
    const stops = [
      stop({ id: 'late', trip_id: 'eu', kind: 'note', title: 'dinner', time: '19:00', day: '2027-06-02', position: 0 }),
      stop({ id: 'early', trip_id: 'eu', kind: 'note', title: 'breakfast', time: '08:00', day: '2027-06-02', position: 1 }),
    ]
    expect(tripNotes(top, trips, stops, []).days[0].items.map((x) => x.key)).toEqual(['stop:early', 'stop:late'])
  })

  it('an untimed check-in ends the day, as in the plan', () => {
    const stops = [
      stop({ id: 'h', trip_id: 'eu', kind: 'stay', title: 'flat', day: '2027-06-02', end_date: '2027-06-05', position: 0, notes: 'key box' }),
      stop({ id: 'f', trip_id: 'eu', kind: 'journey', title: 'flight', day: '2027-06-02', time: '07:05', position: 1, notes: 'one bag' }),
    ]
    expect(tripNotes(top, trips, stops, []).days[0].items.map((x) => x.key)).toEqual(['stop:f', 'stop:h'])
  })

  it('days come in date order', () => {
    const stops = [
      stop({ id: 'b', trip_id: 'eu', kind: 'note', title: 'b', day: '2027-06-09' }),
      stop({ id: 'a', trip_id: 'prg', kind: 'note', title: 'a', day: '2027-06-06' }),
    ]
    expect(tripNotes(top, trips, stops, []).days.map((d) => d.date)).toEqual(['2027-06-06', '2027-06-09'])
  })

  it('link notes sit with the place they are for, or with no date', () => {
    const stops = [stop({ id: 'p', trip_id: 'eu', title: 'kafka museum', day: '2027-06-06' })]
    const links = [
      link({ id: 'l1', stop_id: 'p', title: 'tiktok', note: 'go before 10' }),
      link({ id: 'l2', title: 'blog', note: 'read on the train' }),
      link({ id: 'l3', title: 'no note' }),
      link({ id: 'l4', trip_id: 'jp', note: 'elsewhere' }),
    ]
    const n = tripNotes(top, trips, stops, links)
    expect(n.days[0].items.map((x) => x.key)).toEqual(['link:l1'])
    expect(n.days[0].items[0]).toMatchObject({ title: 'tiktok', text: 'go before 10' })
    expect(n.undated.map((x) => x.key)).toEqual(['link:l2'])
  })

  it('a link with no title is named after its site', () => {
    const n = tripNotes(top, trips, [], [link({ id: 'l', url: 'https://www.youtube.com/watch?v=1', note: 'watch' })])
    expect(n.undated[0].title).toBe('youtube.com')
  })

  it('search looks through titles, words and places, with no case or accents', () => {
    const stops = [
      stop({ id: 'h', trip_id: 'eu', kind: 'stay', title: 'hotel', day: '2027-06-05', notes: 'Late check-in' }),
      stop({ id: 'c', trip_id: 'eu', kind: 'place', title: 'café', day: '2027-06-06', notes: 'try the cake' }),
      stop({ id: 'n', trip_id: 'eu', kind: 'note', title: 'socks', day: null }),
    ]
    expect(tripNotes(top, trips, stops, [], 'late').days.map((d) => d.items.map((x) => x.key))).toEqual([['stop:h']])
    expect(tripNotes(top, trips, stops, [], 'cafe').days.map((d) => d.date)).toEqual(['2027-06-06'])
    expect(tripNotes(top, trips, stops, [], 'cafe').undated).toEqual([])
  })

  it('a row just added (not back from the server yet) has no notes or note field and still shows', () => {
    const fresh = { ...stop({ id: 'j', trip_id: 'eu', kind: 'note', title: 'just jotted', day: null }), notes: undefined } as never
    const bare = { id: 'lb', trip_id: 'eu', url: 'https://a.com', title: 'a' } as never
    const placeNoNotes = { ...stop({ id: 'p', trip_id: 'eu', day: null }), notes: undefined } as never
    const n = tripNotes(top, trips, [fresh, placeNoNotes], [bare], 'just')
    expect(n.undated).toMatchObject([{ key: 'stop:j', text: '' }])
  })

  it('an empty note line is left out', () => {
    expect(tripNotes(top, trips, [stop({ trip_id: 'eu', kind: 'note', title: ' ', notes: '', day: null })], []).undated).toEqual([])
  })
})

describe('undated places', () => {
  it('are the places without a day, notes left out', () => {
    const stops = [
      stop({ id: 'p', trip_id: 'prg', kind: 'place', title: 'café kafka', day: null }),
      stop({ id: 'n', trip_id: 'eu', kind: 'note', title: 'socks', day: null }),
      stop({ id: 'd', trip_id: 'eu', kind: 'place', title: 'dated', day: '2027-06-02' }),
    ]
    expect(undatedPlaces(top, trips, stops).map((s) => s.id)).toEqual(['p'])
  })
})
