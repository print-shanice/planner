import { count } from '../../src/lib/words'
import { nightsWord } from '../../src/lib/dates'

it('counts things in words', () => {
  expect(count(1, 'night')).toBe('1 night')
  expect(count(3, 'night')).toBe('3 nights')
  expect(count(0, 'idea')).toBe('0 ideas')
  expect(count(2, 'side trip')).toBe('2 side trips')
  expect(count(1204, 'review')).toBe('1,204 reviews')
})

it('nightsWord says the nights between two dates, or nothing', () => {
  expect(nightsWord('2027-02-07', '2027-02-11')).toBe('4 nights')
  expect(nightsWord('2027-02-07', '2027-02-08')).toBe('1 night')
  expect(nightsWord('2027-02-07', '2027-02-07')).toBe('')
  expect(nightsWord(null, '2027-02-07')).toBe('')
})
