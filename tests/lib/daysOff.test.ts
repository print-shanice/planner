import { offBetween, offOn, offWords, pickDays, spanWords } from '../../src/lib/daysOff'
import type { DayOff } from '../../src/lib/types'

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
