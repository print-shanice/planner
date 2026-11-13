import { cost } from '../factories'
import { splitLine } from '../../src/lib/settle'

const members = [
  { email: 's@x', user_id: 'u1', name: 'shanice', color: 0 },
  { email: 'k@x', user_id: 'u2', name: 'kai', color: 1 },
  { email: 'j@x', user_id: 'u3', name: 'jo', color: 2 },
]

it('says who a cost is for in a few words', () => {
  expect(splitLine(cost({ split: 'even' }), members)).toBe('split evenly')
  expect(splitLine(cost({ split_among: ['u1', 'u2', 'u3'] }), members)).toBe('split evenly')
  expect(splitLine(cost({ split: 'u2' }), members)).toBe('only for kai')
  expect(splitLine(cost({ split_among: ['u1', 'u3'] }), members)).toBe('for shanice and jo')
  expect(splitLine(cost({ split_among: ['u1', 'u2'], split_amounts: { u1: 1, u2: 2 } }), members)).toBe('exact amounts')
})
