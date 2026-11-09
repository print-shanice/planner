import { describe, expect, it } from 'vitest'
import { isScheduled, scheduleChange, unscheduleChange, unscheduled } from '../../src/lib/schedule'
import { stop, trip } from '../factories'

describe('scheduling', () => {
  it('a stop is scheduled exactly when it has a day, whatever older rows say about saved', () => {
    expect(isScheduled(stop({ day: '2027-02-08', saved: true }))).toBe(true)
    expect(isScheduled(stop({ day: null, saved: false }))).toBe(false)
  })

  it('scheduling puts it last on the day and keeps everything else', () => {
    const s = stop({ id: 'a', trip_id: 't', day: null, saved: true, category: 'cafe', notes: 'n', position: 3 })
    const others = [stop({ trip_id: 't', day: '2027-02-08', position: 4 }), stop({ trip_id: 't', day: '2027-02-09', position: 9 })]
    expect(scheduleChange(s, '2027-02-08', [s, ...others])).toEqual({ id: 'a', day: '2027-02-08', position: 5, saved: false })
  })

  it('moving a stay keeps its nights', () => {
    const s = stop({ id: 'b', kind: 'stay', day: '2027-02-08', end_date: '2027-02-11' })
    expect(scheduleChange(s, '2027-02-10', [s])).toMatchObject({ day: '2027-02-10', end_date: '2027-02-13' })
  })

  it('unscheduling clears only the date and keeps it findable as an idea', () => {
    const s = stop({ id: 'c', trip_id: 't', day: '2027-02-08', time: '10:00', category: 'museum', notes: 'x' })
    const idea = stop({ trip_id: 't', day: null, position: 2 })
    expect(unscheduleChange(s, [s, idea])).toEqual({ id: 'c', day: null, end_date: null, position: 3, saved: true })
  })

  it('lists a family\'s unscheduled stops, side trips included', () => {
    const top = trip({ id: 'top' }), side = trip({ id: 'side', parent_id: 'top' }), other = trip({ id: 'other' })
    const a = stop({ trip_id: 'top', day: null, title: 'a' })
    const b = stop({ trip_id: 'side', day: null, title: 'b', kind: 'note' })
    const c = stop({ trip_id: 'other', day: null })
    const d = stop({ trip_id: 'top', day: '2027-02-08' })
    expect(unscheduled(top, [top, side, other], [a, b, c, d]).map((s) => s.title)).toEqual(['a', 'b'])
  })
})
