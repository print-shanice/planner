import { dayOrder, fitsTime, insertAt, renumber } from '../../src/lib/dayOrder'

type L = { id: string; time: string | null; position: number }
const l = (id: string, time: string | null, position: number): L => ({ id, time, position })
const ids = (xs: { id: string }[]) => xs.map((x) => x.id)

describe('dayOrder', () => {
  it('untimed lines ride under the timed line above them when it moves', () => {
    const lines = [l('explore', '18:00', 0), l('donut', null, 1), l('cola', null, 2), l('haircut', '17:00', 3), l('sushi', null, 4)]
    expect(ids(dayOrder(lines))).toEqual(['haircut', 'sushi', 'explore', 'donut', 'cola'])
  })

  it('untimed lines before the first time stay on top', () => {
    expect(ids(dayOrder([l('jot', null, 0), l('late', '20:00', 1), l('early', '09:00', 2)]))).toEqual(['jot', 'early', 'late'])
  })

  it('equal times keep the order you gave them', () => {
    expect(ids(dayOrder([l('b', '12:34', 1), l('a', '12:34', 0), l('c', '12:34', 2)]))).toEqual(['a', 'b', 'c'])
  })

  it('mixed trips with clashing positions keep a stable order', () => {
    const lines = [l('side-b', null, 0), l('parent-a', null, 0), l('t', '10:00', 1)]
    expect(ids(dayOrder(lines))).toEqual(['parent-a', 'side-b', 't'])
    expect(ids(dayOrder([...lines].reverse()))).toEqual(['parent-a', 'side-b', 't'])
  })

  it('leaves what it was given alone', () => {
    const lines = [l('b', '12:00', 0), l('a', '09:00', 1)]
    dayOrder(lines)
    expect(ids(lines)).toEqual(['b', 'a'])
  })
})

describe('insertAt', () => {
  const day = dayOrder([l('tampopo', '14:30', 0), l('trefac', null, 1), l('aimu', '16:00', 2), l('enji', '19:00', 3)])
  it('a timed line lands after the group at or before its time', () => {
    expect(insertAt(day, '15:30')).toBe(2)
    expect(insertAt(day, '14:30')).toBe(2)
    expect(insertAt(day, '08:00')).toBe(0)
    expect(insertAt(day, '23:00')).toBe(4)
  })
  it('an untimed line goes to the end of the day', () => {
    expect(insertAt(day, null)).toBe(4)
  })
})

describe('fitsTime', () => {
  it('a time later than one below it, or earlier than one above it, does not fit', () => {
    const order = [l('aimu', '16:00', 0), l('kyle', '12:00', 1), l('x', null, 2)]
    expect(fitsTime(order, 'aimu')).toBe(false)
    expect(fitsTime(order, 'kyle')).toBe(false)
  })
  it('untimed lines and lines in time order fit', () => {
    const order = [l('a', '09:00', 0), l('x', null, 1), l('b', '09:00', 2), l('c', '12:00', 3)]
    expect(['a', 'x', 'b', 'c'].every((id) => fitsTime(order, id))).toBe(true)
  })
})

describe('renumber', () => {
  it('gives positions 0..n-1 in order and returns only the ones that change', () => {
    expect(renumber([l('a', null, 0), l('c', null, 5), l('b', null, 2)])).toEqual([{ id: 'c', position: 1 }])
  })
})
