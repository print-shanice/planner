import { busyIn, clashOf, clashWords, holidaysIn, isAway, offBetween, offOn, offWords, pickDays, spanWords } from '../../src/lib/daysOff'
import type { DayOff } from '../../src/lib/types'
import { trip } from '../factories'

const off = (o: Partial<DayOff>): DayOff => ({ id: 'o', name: 'spring break', start_date: '2027-04-24', end_date: '2027-04-30', ...o })
const spring = off({ id: 'sb' })
const friday = off({ id: 'nc', name: 'no classes', start_date: '2027-04-09', end_date: '2027-04-09' })
const may = off({ id: 'm', name: 'may break', start_date: '2027-04-29', end_date: '2027-05-02' })

it('finds the holiday a day is in, the one starting first when two overlap', () => {
  expect(offOn([friday, spring], '2027-04-09')).toBe(friday)
  expect(offOn([friday, spring], '2027-04-10')).toBeUndefined()
  expect(offOn([may, spring], '2027-04-29')).toBe(spring)
  expect(offOn([may, spring], '2027-05-01')).toBe(may)
})

it('says which day of the holiday it is, and just its name for one day', () => {
  expect(offWords(spring, '2027-04-24')).toBe('spring break · day 1 of 7')
  expect(offWords(spring, '2027-04-27')).toBe('spring break · day 4 of 7')
  expect(offWords(friday, '2027-04-09')).toBe('no classes')
})

it('lists the holidays touching a month, by when they start', () => {
  expect(offBetween([may, spring, friday], '2027-04-01', '2027-04-30').map((o) => o.id)).toEqual(['nc', 'sb', 'm'])
  expect(offBetween([may, spring, friday], '2027-05-01', '2027-05-31').map((o) => o.id)).toEqual(['m'])
})

it('marking: the first tap starts, the second ends whichever way round, a third starts again', () => {
  expect(pickDays(null, '2027-04-24')).toEqual(['2027-04-24', null])
  expect(pickDays(['2027-04-24', null], '2027-04-30')).toEqual(['2027-04-24', '2027-04-30'])
  expect(pickDays(['2027-04-30', null], '2027-04-24')).toEqual(['2027-04-24', '2027-04-30'])
  expect(pickDays(['2027-04-09', null], '2027-04-09')).toEqual(['2027-04-09', '2027-04-09'])
  expect(pickDays(['2027-04-24', '2027-04-30'], '2027-04-12')).toEqual(['2027-04-12', null])
})

it('says the picked days in words, with how many', () => {
  expect(spanWords('2027-04-24', '2027-04-30')).toBe('sat 24 – fri 30 apr · 7 days')
  expect(spanWords('2027-04-28', '2027-05-02')).toBe('wed 28 apr – sun 2 may · 5 days')
  expect(spanWords('2027-04-09', '2027-04-09')).toBe('fri 9 apr · 1 day')
})

describe("days you can't travel", () => {
  const exams = off({ id: 'ex', name: 'Exams', start_date: '2027-06-14', end_date: '2027-06-25', busy: true })
  const exchange = trip({ id: 'nl', name: 'exchange', start_date: '2027-01-28', end_date: '2027-07-13' })
  const berlin = trip({ id: 'be', parent_id: 'nl', name: 'berlin', start_date: '2027-06-11', end_date: '2027-06-14' })
  const porto = trip({ id: 'po', parent_id: 'nl', name: 'porto', start_date: '2027-06-26', end_date: '2027-06-29' })
  const trips = [exchange, berlin, porto]

  it('splits your holidays from the days you can\'t travel', () => {
    expect(holidaysIn([spring, exams])).toEqual([spring])
    expect(busyIn([spring, exams])).toEqual([exams])
  })

  it('a trip is away when it is a side trip or a short trip of its own; a long stay like the exchange is home', () => {
    expect(isAway(berlin)).toBe(true)
    expect(isAway(exchange)).toBe(false)
    expect(isAway(trip({ start_date: '2027-08-01', end_date: '2027-08-20' }))).toBe(true)
    expect(isAway(trip({ start_date: null, end_date: null }))).toBe(false)
  })

  it('a trip away that lands on them clashes, on the days it owns', () => {
    expect(clashOf(berlin, trips, [exams])).toEqual({ off: exams, from: '2027-06-14', to: '2027-06-14' })
    expect(clashOf(porto, trips, [exams])).toBeNull()
    // the exchange is where the exams are, and berlin's day is berlin's to say
    expect(clashOf(exchange, trips, [exams])).toBeNull()
    const longer = { ...berlin, end_date: '2027-06-16' }
    expect(clashOf(longer, [exchange, longer], [exams])).toEqual({ off: exams, from: '2027-06-14', to: '2027-06-16' })
    // a side trip's own side trip says it for its days
    const munich = trip({ id: 'mu', parent_id: 'be', start_date: '2027-06-14', end_date: '2027-06-14' })
    expect(clashOf(berlin, [...trips, munich], [exams])).toBeNull()
    expect(clashOf(munich, [...trips, munich], [exams])).toEqual({ off: exams, from: '2027-06-14', to: '2027-06-14' })
  })

  it('says the clash in words', () => {
    expect(clashWords({ off: exams, from: '2027-06-14', to: '2027-06-14' })).toBe("can't travel mon 14 jun · exams")
    expect(clashWords({ off: exams, from: '2027-06-14', to: '2027-06-16' })).toBe("can't travel mon 14 – wed 16 jun · exams")
  })
})
