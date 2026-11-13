import { monthWeeks, openingMonth, shiftMonth, tripSpan, weekBars, type Span } from '../../src/lib/calendar'
import type { Trip } from '../../src/lib/types'
import { trip } from '../factories'

const spans = (ts: Trip[]) => ts.map(tripSpan).filter((x): x is Span => !!x)

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

it('clips side-trip bars to the week and stacks overlaps in lanes', () => {
  const week = ['2027-02-08', '2027-02-09', '2027-02-10', '2027-02-11', '2027-02-12', '2027-02-13', '2027-02-14']
  const lap = trip({ id: 'lap', start_date: '2027-02-07', end_date: '2027-02-11' })
  const par = trip({ id: 'par', start_date: '2027-02-10', end_date: '2027-02-12' })
  const ber = trip({ id: 'ber', start_date: '2027-02-13', end_date: '2027-02-20' })
  const far = trip({ id: 'far', start_date: '2027-03-01', end_date: '2027-03-02' })
  const bars = weekBars(week, spans([ber, par, far, lap]))
  expect(bars.map((b) => [b.span.id, b.from, b.to, b.starts, b.ends, b.lane])).toEqual([
    ['lap', 0, 3, false, true, 0],
    ['par', 2, 4, true, true, 1],
    ['ber', 5, 6, true, false, 0],
  ])
})

it('only counts the days of the week that are in the month', () => {
  const week = [null, null, null, null, '2027-01-01', '2027-01-02', '2027-01-03']
  const nye = trip({ start_date: '2026-12-30', end_date: '2027-01-02' })
  expect(weekBars(week, spans([nye])).map((b) => [b.from, b.to, b.starts, b.ends])).toEqual([[4, 5, false, true]])
})
