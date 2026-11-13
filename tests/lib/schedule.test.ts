import { describe, expect, it } from 'vitest'
import { nextPosition } from '../../src/lib/schedule'
import { stop } from '../factories'

describe('scheduling', () => {
  it('the next position is after the last line of that trip on that day, ideas counting as their own day', () => {
    const stops = [
      stop({ id: 'a', trip_id: 't', day: '2027-02-08', position: 4 }),
      stop({ id: 'b', trip_id: 't', day: '2027-02-08', position: 7 }),
      stop({ trip_id: 'other', day: '2027-02-08', position: 20 }),
      stop({ trip_id: 't', day: null, position: 2 }),
    ]
    expect(nextPosition(stops, 't', '2027-02-08')).toBe(8)
    expect(nextPosition(stops, 't', '2027-02-08', 'b')).toBe(5)
    expect(nextPosition(stops, 't', null)).toBe(3)
    expect(nextPosition(stops, 't', '2027-02-09')).toBe(0)
  })
})
