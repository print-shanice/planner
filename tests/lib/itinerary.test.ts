import { trip, stop, place } from '../factories'
import { dayAreas, findMatches, itineraryDays, marked, matchesStop, normal } from '../../src/lib/itinerary'

const tokyo = () => trip({ id: 'tk', name: 'tokyo', start_date: '2026-09-18', end_date: '2026-09-21' })

describe('itineraryDays', () => {
  it('lists every day of a short trip, with each day in time order', () => {
    const t = tokyo()
    const late = stop({ id: 'late', trip_id: 'tk', day: '2026-09-19', time: '17:00', title: 'cut hair at assort' })
    const early = stop({ id: 'early', trip_id: 'tk', day: '2026-09-19', time: '09:00', title: 'narita' })
    const { days } = itineraryDays(t, [t], [late, early])
    expect(days.map((d) => d.date)).toEqual(['2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21'])
    expect(days[1].entries.map((e) => e.stop!.id)).toEqual(['early', 'late'])
    expect(days[1].owner.id).toBe('tk')
  })

  it("puts a side trip's days in place, owned by the innermost trip, with the parent's things too", () => {
    const eu = trip({ id: 'eu', start_date: '2027-01-28', end_date: '2027-07-13' })
    const paris = trip({ id: 'paris', parent_id: 'eu', name: 'paris', start_date: '2027-02-20', end_date: '2027-02-22', color: 2 })
    const flat = stop({ id: 'flat', trip_id: 'eu', kind: 'stay', title: 'student flat', day: '2027-01-28', end_date: '2027-07-13' })
    const louvre = stop({ id: 'louvre', trip_id: 'paris', day: '2027-02-21', title: 'louvre' })
    const { days } = itineraryDays(eu, [eu, paris], [flat, louvre])
    const d21 = days.find((d) => d.date === '2027-02-21')!
    expect(d21.owner.id).toBe('paris')
    expect(d21.entries.map((e) => `${e.kind}:${e.stop!.id}`)).toEqual(['staying:flat', 'stop:louvre'])
    // a long trip only lists days where something starts or ends, plus every day of a short side trip
    expect(days.map((d) => d.date)).toEqual(['2027-01-28', '2027-02-20', '2027-02-21', '2027-02-22', '2027-07-13'])
    expect(days.find((d) => d.date === '2027-01-28')!.owner.id).toBe('eu')
  })

  it("drops the parent's \"staying at\" on a side trip's night with its own stay", () => {
    const eu = trip({ id: 'eu', start_date: '2027-01-28', end_date: '2027-07-13' })
    const paris = trip({ id: 'paris', parent_id: 'eu', start_date: '2027-02-20', end_date: '2027-02-23' })
    const flat = stop({ id: 'flat', trip_id: 'eu', kind: 'stay', day: '2027-01-28', end_date: '2027-07-13' })
    const hotel = stop({ id: 'hotel', trip_id: 'paris', kind: 'stay', day: '2027-02-20', end_date: '2027-02-22' })
    const { days } = itineraryDays(eu, [eu, paris], [flat, hotel])
    const on = (d: string) => days.find((x) => x.date === d)!.entries.map((e) => `${e.kind}:${e.stop!.id}`)
    expect(on('2027-02-21')).toEqual(['staying:hotel'])
    // checking out, the hotel isn't that night's bed
    expect(on('2027-02-22')).toEqual(['staying:flat', 'checkout:hotel'])
    expect(on('2027-02-23')).toEqual(['staying:flat'])
  })

  it('collects undated stops, but never saved ideas', () => {
    const t = tokyo()
    const loose = stop({ id: 'loose', trip_id: 'tk', day: null, title: 'onsen' })
    const idea = stop({ id: 'idea', trip_id: 'tk', day: null, saved: true, title: 'maybe' })
    expect(itineraryDays(t, [t], [loose, idea]).undated.map((s) => s.id)).toEqual(['loose'])
  })

  it('leaves saved ideas out of the days too', () => {
    const t = tokyo()
    const idea = stop({ id: 'idea', trip_id: 'tk', day: '2026-09-19', saved: true })
    expect(itineraryDays(t, [t], [idea]).days[1].entries).toEqual([])
  })
})

describe('dayAreas', () => {
  it("names the day's areas once each, in order, falling back to the city", () => {
    const entries = [
      { kind: 'stop' as const, stop: stop({ place: place({ area: 'shibuya', city: 'tokyo' }) }) },
      { kind: 'stop' as const, stop: stop({ place: place({ city: 'tokyo' }) }) },
      { kind: 'stop' as const, stop: stop({ place: place({ area: 'Shibuya', city: 'tokyo' }) }) },
      { kind: 'stop' as const, stop: stop({ place: null }) },
      { kind: 'staying' as const, stop: stop({ kind: 'stay', place: place({ area: 'itabashi' }) }) },
      { kind: 'stop' as const, stop: stop({ kind: 'journey', destination: place({ area: 'narita' }) }) },
    ]
    expect(dayAreas(entries)).toEqual(['shibuya', 'tokyo', 'narita'])
  })
})

describe('search', () => {
  it('matches without case or accents, in titles, places, notes and refs', () => {
    expect(normal('Café Ünter')).toBe('cafe unter')
    expect(matchesStop(stop({ title: 'Iyoshi Cola' }), 'iyoshi')).toBe(true)
    expect(matchesStop(stop({ title: 'dinner', place: place({ name: '縁慈 (enji)' }) }), '縁慈')).toBe(true)
    expect(matchesStop(stop({ title: 'yakiniku', notes: 'name: Yamamoto' }), 'yamamoto')).toBe(true)
    expect(matchesStop(stop({ title: 'enji', ref: 'MVE5DHSCL6' }), 'mve5d')).toBe(true)
    expect(matchesStop(stop({ kind: 'journey', title: '', origin: place({ name: 'narita' }), destination: place({ name: 'nippori' }) }), 'nippori')).toBe(true)
    expect(matchesStop(stop({ title: 'x', place: place({ area: 'koenji' }) }), 'koenji')).toBe(true)
    expect(matchesStop(stop({ title: 'cafe' }), 'cola')).toBe(false)
    expect(matchesStop(stop({ title: 'cafe' }), '  ')).toBe(false)
  })

  it('lists every matching line in order, once each, across days and the undated list', () => {
    const t = tokyo()
    const a = stop({ id: 'a', trip_id: 'tk', day: '2026-09-19', title: 'iyoshi cola' })
    const b = stop({ id: 'b', trip_id: 'tk', day: '2026-09-19', title: 'iyoshi cola again', time: '10:00' })
    const c = stop({ id: 'c', trip_id: 'tk', day: '2026-09-21', title: "i'm donut", notes: 'next to iyoshi' })
    const d = stop({ id: 'd', trip_id: 'tk', day: null, title: 'iyoshi maybe' })
    const stay = stop({ id: 'st', trip_id: 'tk', kind: 'stay', title: 'iyoshi house', day: '2026-09-18', end_date: '2026-09-21' })
    const it = itineraryDays(t, [t], [a, b, c, d, stay])
    expect(findMatches(it, 'IYOSHI').map((m) => `${m.date}:${m.id}`)).toEqual([
      '2026-09-18:st', '2026-09-19:b', '2026-09-19:a', '2026-09-21:c', 'null:d',
    ])
    expect(findMatches(it, '')).toEqual([])
  })
})

describe('marked', () => {
  it('splits text around matches, keeping the original letters', () => {
    expect(marked('Iyoshi Cola', 'iyoshi')).toEqual([{ text: 'Iyoshi', hit: true }, { text: ' Cola', hit: false }])
    expect(marked('Café de Flore', 'cafe')).toEqual([{ text: 'Café', hit: true }, { text: ' de Flore', hit: false }])
    expect(marked('a b a', 'a')).toEqual([{ text: 'a', hit: true }, { text: ' b ', hit: false }, { text: 'a', hit: true }])
    expect(marked('nothing', 'x')).toEqual([{ text: 'nothing', hit: false }])
    expect(marked('nothing', '')).toEqual([{ text: 'nothing', hit: false }])
  })
})
