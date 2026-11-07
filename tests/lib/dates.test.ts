import { tripDays, stayDays, groupByDay, visibleDays, countdown, nights, dayColor } from '../../src/lib/dates'
import { trip, stop } from '../factories'

const t = trip({ id: 't0', start_date: '2027-02-07', end_date: '2027-02-11' })

it('tripDays is inclusive', () => {
  expect(tripDays(t)).toEqual(['2027-02-07', '2027-02-08', '2027-02-09', '2027-02-10', '2027-02-11'])
})

it('tripDays is empty without both dates', () => {
  expect(tripDays(trip({ start_date: null, end_date: null }))).toEqual([])
})

it('nights between two dates', () => {
  expect(nights('2027-02-07', '2027-02-11')).toBe(4)
  expect(nights(null, '2027-02-11')).toBeNull()
})

it('stay covers check-in to check-out', () => {
  expect(stayDays(stop({ kind: 'stay', day: '2027-02-07', end_date: '2027-02-09' }))).toEqual(['2027-02-07', '2027-02-08', '2027-02-09'])
})

it('reversed stay is one day', () => {
  expect(stayDays(stop({ kind: 'stay', day: '2027-02-09', end_date: '2027-02-07' }))).toEqual(['2027-02-09'])
})

it('stay entries: check in, staying, check out', () => {
  const g = groupByDay(t, [stop({ id: 's', kind: 'stay', day: '2027-02-07', end_date: '2027-02-09' })], [])
  expect(g.days[0].entries[0]).toMatchObject({ kind: 'checkin' })
  expect(g.days[1].entries[0]).toMatchObject({ kind: 'staying' })
  expect(g.days[2].entries[0]).toMatchObject({ kind: 'checkout' })
})

it('undated stops go to undated', () => {
  expect(groupByDay(t, [stop({ day: null })], []).undated).toHaveLength(1)
})

it('trip without dates still groups its dated stops', () => {
  const g = groupByDay(trip({ start_date: null, end_date: null }), [stop({ day: '2027-03-01' })], [])
  expect(g.days.map((d) => d.date)).toEqual(['2027-03-01'])
})

it('long trips show only busy days', () => {
  const long = trip({ start_date: '2027-01-28', end_date: '2027-07-13' })
  const child = trip({ id: 'c', parent_id: long.id, start_date: '2027-02-07', end_date: '2027-02-08' })
  expect(visibleDays(long, [stop({ day: '2027-03-01' })], [child])).toEqual(['2027-02-07', '2027-03-01'])
})

it('in a long trip a long stay only adds its check-in and check-out days', () => {
  const long = trip({ start_date: '2027-01-28', end_date: '2027-07-13' })
  const home = stop({ kind: 'stay', day: '2027-01-28', end_date: '2027-07-13' })
  expect(visibleDays(long, [home], [])).toEqual(['2027-01-28', '2027-07-13'])
})

it('short trips show every day', () => {
  expect(visibleDays(t, [], [])).toHaveLength(5)
})

it('side trips come first, then stops by position then time', () => {
  const child = trip({ id: 'c', start_date: '2027-02-08', end_date: '2027-02-09' })
  const a = stop({ id: 'a', day: '2027-02-08', position: 2, time: '09:00' })
  const b = stop({ id: 'b', day: '2027-02-08', position: 1, time: '10:00' })
  const day = groupByDay(t, [a, b], [child]).days.find((d) => d.date === '2027-02-08')!
  expect(day.entries.map((e) => e.kind === 'sidetrip' ? e.trip!.id : e.stop!.id)).toEqual(['c', 'b', 'a'])
})

it('countdown', () => {
  expect(countdown(t, '2026-11-05')).toEqual({ kind: 'upcoming', days: 94 })
  expect(countdown(t, '2027-02-08')).toEqual({ kind: 'ongoing', days: 2 })
  expect(countdown(t, '2027-03-01')).toEqual({ kind: 'done', days: 0 })
  expect(countdown(trip({ start_date: null }), '2027-03-01')).toEqual({ kind: 'undated', days: 0 })
})

it('dayColor is the trip colour', () => {
  expect(dayColor(0)).toBe('var(--g0)')
  expect(dayColor(7)).toBe('var(--g1)')
  expect(dayColor(null)).toBe('var(--g0)')
})

it('fmtRange is short and lowercase', async () => {
  const { fmtRange } = await import('../../src/lib/dates')
  expect(fmtRange('2027-02-07', '2027-02-11')).toBe('7 – 11 feb')
  expect(fmtRange('2027-01-28', '2027-07-13')).toBe('28 jan – 13 jul')
})

it('a long stay in a long trip does not fill every day with staying rows', () => {
  const long = trip({ start_date: '2027-01-28', end_date: '2027-07-13' })
  const home = stop({ kind: 'stay', day: '2027-01-28', end_date: '2027-07-13' })
  const museum = stop({ day: '2027-03-01' })
  const g = groupByDay(long, [home, museum], [])
  expect(g.days.map((d) => d.date)).toEqual(['2027-01-28', '2027-03-01', '2027-07-13'])
  expect(g.days[1].entries.map((e) => e.kind)).toEqual(['staying', 'stop'])
})
