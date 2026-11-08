import { readTime } from '../../src/lib/time'

it('reads a typed time the ways people write it', () => {
  const cases: [string, string | null][] = [
    ['', null], ['  ', null], ['any', null],
    ['9', '09:00'], ['09', '09:00'], ['930', '09:30'], ['0930', '09:30'], ['9:30', '09:30'], ['9.30', '09:30'],
    ['13:00', '13:00'], ['1300', '13:00'], ['1pm', '13:00'], ['1 PM', '13:00'], ['1:30pm', '13:30'],
    ['12am', '00:00'], ['12pm', '12:00'], ['11:45 am', '11:45'], ['23:59', '23:59'],
  ]
  for (const [typed, want] of cases) expect(readTime(typed), typed).toBe(want)
})

it('says when it cannot read a time', () => {
  for (const bad of ['25:00', '9:75', '13pm', 'noon', '12345', '0am']) expect(readTime(bad), bad).toBe(undefined)
})
