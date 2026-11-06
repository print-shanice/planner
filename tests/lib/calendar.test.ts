import { citySpans, monthTree, monthWeeks, openingMonth, planItems, ribbonDay, shiftMonth, tripSpan, weekBars, type Span } from '../../src/lib/calendar'
import { groupByDay } from '../../src/lib/dates'
import type { Trip } from '../../src/lib/types'
import { place, stop, trip } from '../factories'

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

it('gives a shared day to the top-level trip that starts first', () => {
  const a = trip({ id: 'a', start_date: '2027-02-05', end_date: '2027-02-10' })
  const b = trip({ id: 'b', start_date: '2027-02-01', end_date: '2027-02-06' })
  expect(ribbonDay('2027-02-05', spans([a, b]))?.id).toBe('b')
  expect(ribbonDay('2027-02-08', spans([a, b]))?.id).toBe('a')
  expect(ribbonDay('2027-02-11', spans([a, b]))).toBeUndefined()
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

it('lists the trips touching a month as a tree', () => {
  const ex = trip({ id: 'ex', name: 'exchange', start_date: '2027-01-28', end_date: '2027-07-13' })
  const lap = trip({ id: 'lap', parent_id: 'ex', start_date: '2027-02-07', end_date: '2027-02-11' })
  const sami = trip({ id: 'sami', parent_id: 'lap', start_date: '2027-02-09', end_date: '2027-02-10' })
  const par = trip({ id: 'par', parent_id: 'ex', start_date: '2027-02-02', end_date: '2027-02-04' })
  const mar = trip({ id: 'mar', parent_id: 'ex', start_date: '2027-03-05', end_date: '2027-03-08' })
  const ski = trip({ id: 'ski', start_date: '2027-02-20', end_date: '2027-02-27' })
  const idea = trip({ id: 'idea', parent_id: 'ex', start_date: null, end_date: null })
  expect(monthTree('2027-02', [ski, sami, mar, lap, ex, par, idea]).map((r) => [r.trip.id, r.depth])).toEqual([
    ['ex', 0], ['par', 1], ['lap', 1], ['sami', 2], ['ski', 0],
  ])
})

it("labels each of a trip's own days with the city you sleep in", () => {
  const ex = trip({ id: 'ex', start_date: '2027-02-01', end_date: '2027-02-12', base: place({ name: 'eindhoven', city: 'eindhoven' }) })
  const lap = trip({ id: 'lap', parent_id: 'ex', start_date: '2027-02-07', end_date: '2027-02-09' })
  const stops = [
    stop({ trip_id: 'ex', kind: 'stay', day: '2027-02-02', end_date: '2027-02-04', place: place({ name: 'hotel v', city: 'amsterdam' }) }),
    stop({ trip_id: 'ex', kind: 'journey', day: '2027-02-11', destination: place({ name: 'brussels-midi', city: 'brussels' }) }),
    // a stay without a city doesn't name the night
    stop({ trip_id: 'ex', kind: 'stay', day: '2027-02-05', end_date: '2027-02-06', place: place({ name: 'friend\'s flat' }) }),
  ]
  expect(citySpans(ex, stops, [lap]).map((c) => [c.name, c.start, c.end])).toEqual([
    ['eindhoven', '2027-02-01', '2027-02-01'],
    ['amsterdam', '2027-02-02', '2027-02-03'],
    ['eindhoven', '2027-02-04', '2027-02-06'],
    // 7 – 9 belong to lapland
    ['eindhoven', '2027-02-10', '2027-02-10'],
    ['brussels', '2027-02-11', '2027-02-11'],
    ['eindhoven', '2027-02-12', '2027-02-12'],
  ])
  expect(citySpans(trip({ start_date: '2027-02-01', end_date: '2027-02-03' }), [], [])).toEqual([])
})

it("folds a side trip's days into one row unless the parent has its own plans that day", () => {
  const ex = trip({ id: 'ex', start_date: '2027-02-01', end_date: '2027-02-14' })
  const lap = trip({ id: 'lap', parent_id: 'ex', start_date: '2027-02-07', end_date: '2027-02-11' })
  const someday = trip({ id: 'some', parent_id: 'ex', start_date: null, end_date: null })
  const stops = [
    stop({ trip_id: 'ex', kind: 'stay', title: 'home', day: '2027-02-01', end_date: '2027-02-14' }),
    stop({ trip_id: 'ex', title: 'pay rent', day: '2027-02-09' }),
  ]
  const { days } = groupByDay(ex, stops, [lap, someday])
  const items = planItems(days, [lap, someday])
  expect(items.map((i) => (i.kind === 'fold' ? `fold ${i.trip.id}` : i.date.slice(8)))).toEqual([
    '01', '02', '03', '04', '05', '06', 'fold lap', '09', '12', '13', '14',
  ])
  // day cards no longer carry the side trip
  const first = items.find((i) => i.kind === 'day' && i.date === '2027-02-09')
  expect(first?.kind === 'day' && first.entries.some((e) => e.kind === 'sidetrip')).toBe(false)
})
