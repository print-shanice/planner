import { cost } from '../factories'
import { balances, isPayback, transfers } from '../../src/lib/settle'

const R = { date: '2026-11-04', rates: { SGD: 2 } }
const people = ['a', 'b', 'c']

it('a cost for some people is shared only by them', () => {
  const b = balances([cost({ amount: 90, currency: 'EUR', status: 'paid', paid_by: 'a', split_among: ['a', 'b'] })], people, R)
  expect(transfers(b)).toEqual([{ from: 'b', to: 'a', eur: 45 }])
  expect(b.c ?? 0).toBe(0)
})

it('exact amounts are owed as given, in the cost’s own currency', () => {
  const b = balances([cost({ amount: 100, currency: 'SGD', status: 'paid', paid_by: 'a', split_among: ['a', 'b', 'c'], split_amounts: { a: 20, b: 50, c: 30 } })], people, R)
  expect(transfers(b)).toEqual([{ from: 'b', to: 'a', eur: 25 }, { from: 'c', to: 'a', eur: 15 }])
})

it('"everyone" means the people stored on the cost, so a newcomer owes nothing for older costs', () => {
  const b = balances([cost({ amount: 40, currency: 'EUR', status: 'paid', paid_by: 'a', split_among: ['a', 'b'] })], [...people, 'd'], R)
  expect(transfers(b)).toEqual([{ from: 'b', to: 'a', eur: 20 }])
})

it('older rows still read: even is everyone, a person is just them', () => {
  expect(transfers(balances([cost({ amount: 30, status: 'paid', paid_by: 'a', split: 'even', currency: 'EUR' })], people, R)))
    .toEqual([{ from: 'b', to: 'a', eur: 10 }, { from: 'c', to: 'a', eur: 10 }])
  expect(transfers(balances([cost({ amount: 30, status: 'paid', paid_by: 'a', split: 'c', currency: 'EUR' })], people, R)))
    .toEqual([{ from: 'c', to: 'a', eur: 30 }])
})

it('a pay-back squares the debt it pays', () => {
  const owed = cost({ amount: 40, currency: 'EUR', status: 'paid', paid_by: 'b', split_among: ['a', 'b'] })
  const back = cost({ amount: 20, currency: 'EUR', status: 'paid', paid_by: 'a', split_among: ['b'], split: 'b', category: 'repayment' })
  expect(isPayback(back)).toBe(true)
  expect(isPayback(owed)).toBe(false)
  expect(transfers(balances([owed, back], ['a', 'b'], R))).toEqual([])
})

it('three people settle with the fewest payments', () => {
  const b = balances([
    cost({ amount: 90, currency: 'EUR', status: 'paid', paid_by: 'a', split_among: people }),
    cost({ amount: 30, currency: 'EUR', status: 'paid', paid_by: 'b', split_among: people }),
  ], people, R)
  expect(transfers(b)).toEqual([{ from: 'c', to: 'a', eur: 40 }, { from: 'b', to: 'a', eur: 10 }])
})
