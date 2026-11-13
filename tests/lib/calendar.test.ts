import { monthWeeks, openingMonth, shiftMonth } from '../../src/lib/calendar'
import { trip } from '../factories'

it('shifts months across years both ways', () => {
  expect(shiftMonth('2027-12', 1)).toBe('2028-01')
  expect(shiftMonth('2027-01', -1)).toBe('2026-12')
  expect(shiftMonth('2027-03', -14)).toBe('2026-01')
})

it('lays a month out in monday-first weeks with blanks outside it', () => {
  const jan = monthWeeks('2027-01')
  expect(jan[0]).toEqual([null, null, null, null, '2027-01-01', '2027-01-02', '2027-01-03'])
  expect(jan.at(-1)).toEqual(['2027-01-25', '2027-01-26', '2027-01-27', '2027-01-28', '2027-01-29', '2027-01-30', '2027-01-31'])
  expect(jan).toHaveLength(5)
  const feb = monthWeeks('2027-02')
  expect(feb).toHaveLength(4)
  expect(feb[0][0]).toBe('2027-02-01')
  expect(monthWeeks('2026-11')[0]).toEqual([null, null, null, null, null, null, '2026-11-01'])
})

it('opens on a trip that is on now, else the soonest upcoming start', () => {
  const ex = trip({ start_date: '2027-01-28', end_date: '2027-07-13' })
  const sum = trip({ start_date: '2027-06-01', end_date: '2027-06-10' })
  const old = trip({ start_date: '2026-01-01', end_date: '2026-01-05' })
  const side = trip({ parent_id: ex.id, start_date: '2026-12-01', end_date: '2026-12-03' })
  expect(openingMonth([sum, ex, old, side], '2026-11-05')).toBe('2027-01')
  expect(openingMonth([sum, ex], '2027-03-02')).toBe('2027-03')
  expect(openingMonth([old, trip({ start_date: null, end_date: null })], '2026-11-05')).toBeNull()
})
