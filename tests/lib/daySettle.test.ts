import { settleDay } from '../../src/lib/daySettle'
import { dayOrder } from '../../src/lib/dayOrder'
import { trip, stop } from '../factories'

const D = '2025-09-21'
const top = trip({ id: 'tk', start_date: '2025-09-18', end_date: '2025-09-26' })
const side = trip({ id: 'sd', parent_id: 'tk', start_date: '2025-09-21', end_date: '2025-09-22' })
const on = (id: string, time: string | null, position: number, trip_id = 'tk') => stop({ id, trip_id, day: D, time, position })

function apply<T extends { id: string; position: number }>(rows: T[], changes: { id: string; position: number }[]): T[] {
  return rows.map((r) => ({ ...r, ...changes.find((c) => c.id === r.id) }))
}

it('a time change stores the new order, so clearing the time later leaves the line where it is', () => {
  const before = [on('horin', '09:00', 0), on('kyle', '12:00', 1), on('fujiya', '12:20', 2), on('trefac', null, 3), on('aimu', '16:00', 4)]
  const moved = { ...before[1], time: '15:00' }
  const now = before.map((s) => (s.id === 'kyle' ? moved : s))
  const settled = apply(now, settleDay(top, [top, side], now, moved))
  expect(dayOrder(settled).map((s) => s.id)).toEqual(['horin', 'fujiya', 'trefac', 'kyle', 'aimu'])
  const cleared = settled.map((s) => (s.id === 'kyle' ? { ...s, time: null } : s))
  expect(dayOrder(cleared).map((s) => s.id)).toEqual(['horin', 'fujiya', 'trefac', 'kyle', 'aimu'])
})

it('settles the whole family\'s lines that day, side trip and parent together, and nothing else', () => {
  const rows = [on('a', '10:00', 0), on('b', '09:00', 0, 'sd'), stop({ id: 'other-day', trip_id: 'tk', day: '2025-09-22', position: 9 })]
  const changes = settleDay(top, [top, side], rows, rows[0])
  expect(changes).toEqual([{ id: 'a', position: 1 }])
})

it('an idea (no day) settles nothing', () => {
  const idea = stop({ id: 'i', trip_id: 'tk', day: null })
  expect(settleDay(top, [top], [idea], idea)).toEqual([])
})

it('a line that has only just been added counts too', () => {
  const rows = [on('a', '10:00', 0), on('b', null, 1)]
  const fresh = on('new', '09:00', 2)
  expect(settleDay(top, [top], rows, fresh)).toEqual([{ id: 'new', position: 0 }, { id: 'a', position: 1 }, { id: 'b', position: 2 }])
})
