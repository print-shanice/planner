import { trip, stop } from '../factories'
import { rememberPlan, resumePlan, forgetResume } from '../../src/lib/resume'

const today = '2027-02-08'
const parent = trip({ id: 'parent', start_date: '2027-02-01', end_date: '2027-03-01' })
const child = trip({ id: 'child', parent_id: 'parent' })
const family = [parent, child]

it('resumes the exact child and day last read', () => {
  rememberPlan({ tripId: 'child', day: '2027-02-10' })
  expect(resumePlan(family, [], today)).toEqual({ tripId: 'child', day: '2027-02-10' })
})
it.each(['{broken', 'null', '{"tripId":"deleted","day":"2027-02-10"}'])('invalid or deleted context falls back to the current root trip: %s', value => {
  localStorage.setItem('planner-resume', value)
  expect(resumePlan(family, [], today)).toEqual({ tripId: 'parent', day: today })
})
it('revalidates a remembered date after trip dates change', () => {
  rememberPlan({ tripId: 'child', day: '2027-02-10' })
  const changed = { ...child, start_date: '2027-03-01', end_date: '2027-03-03' }
  expect(resumePlan([parent, changed], [], today)).toEqual({ tripId: 'child', day: '2027-03-01' })
  expect(resumePlan([parent, changed], [stop({ trip_id: 'child', day: '2027-02-10' })], today)?.day).toBe('2027-02-10')
})
it('ignores impossible dates and safely handles blocked storage', () => {
  rememberPlan({ tripId: 'child', day: '2027-02-30' })
  expect(resumePlan(family, [], today)?.day).toBe(today)
  const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
  const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
  try {
    expect(() => rememberPlan({ tripId: 'child', day: today })).not.toThrow()
    expect(resumePlan(family, [], today)).toEqual({ tripId: 'parent', day: today })
  } finally { get.mockRestore(); set.mockRestore() }
})
it('forgetting the device removes the resume context; no trips yields no shortcut', () => {
  rememberPlan({ tripId: 'child', day: today }); forgetResume()
  expect(localStorage.getItem('planner-resume')).toBeNull()
  expect(resumePlan([], [], today)).toBeNull()
})
