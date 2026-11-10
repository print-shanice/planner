import { clampSplit, readSplit, saveSplit, SPLIT_MIN, MAP_MIN } from '../../src/lib/split'

describe('the plan and map split', () => {
  beforeEach(() => localStorage.clear())
  it('keeps both sides usable', () => {
    expect(clampSplit(100, 1440)).toBe(SPLIT_MIN)
    expect(clampSplit(2000, 1440)).toBe(1440 - MAP_MIN)
    expect(clampSplit(700.4, 1440)).toBe(700)
  })
  it('never lets the plan go under its minimum on a narrow laptop', () => {
    expect(clampSplit(900, 1024)).toBe(1024 - MAP_MIN)
    expect(clampSplit(300, 600)).toBe(SPLIT_MIN)
  })
  it('remembers the width on this device, and forgets it when reset', () => {
    expect(readSplit()).toBeNull()
    saveSplit(712)
    expect(readSplit()).toBe(712)
    saveSplit(null)
    expect(readSplit()).toBeNull()
  })
  it('ignores a stored value that is not a width', () => {
    localStorage.setItem('planner.split', 'wide')
    expect(readSplit()).toBeNull()
  })
})
