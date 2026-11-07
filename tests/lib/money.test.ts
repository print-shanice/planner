import { convert, toEur, totals, formatMoney } from '../../src/lib/money'
import { balances, transfers } from '../../src/lib/settle'
import { fetchRates } from '../../src/lib/rates'
import { cost } from '../factories'

const R = { date: '2026-11-04', rates: { SGD: 1.4398, ISK: 136.8 } }

it('converts via EUR', () => expect(convert(100, 'EUR', 'SGD', R)).toBeCloseTo(143.98))
it('same currency is identity even without rates', () => expect(convert(50, 'MAD', 'MAD', null)).toBe(50))
it('manual rate used when ECB lacks it', () => expect(toEur(108, 'MAD', R, 10.8)).toBeCloseTo(10))
it('unknown currency without a rate converts to null', () => expect(toEur(10, 'MAD', R, null)).toBeNull())

it('unknown currency without rate is left out, never NaN', () => {
  const t = totals([
    cost({ amount: 50, currency: 'MAD', eur_rate: null, status: 'paid' }),
    cost({ amount: 100, currency: 'EUR', status: 'estimate', category: 'food' }),
  ], 'SGD', R)
  expect(t.leftOut).toBe(1)
  expect(t.planned).toBeCloseTo(143.98)
  expect(t.paid).toBe(0)
  expect(t.byCategory.food.planned).toBeCloseTo(143.98)
})

it('formatMoney rounds to whole units when asked', () => {
  expect(formatMoney(23.98, 'EUR', { whole: true })).toBe('€24')
  expect(formatMoney(12.5, 'EUR', { whole: true })).toBe('€13')
  expect(formatMoney(-0.4, 'EUR', { whole: true })).toBe('€0')
})

it('formatMoney', () => {
  expect(formatMoney(206.5, 'SGD')).toBe('S$207')
  expect(formatMoney(12.5, 'EUR')).toBe('€12.50')
  expect(formatMoney(12, 'EUR')).toBe('€12')
  expect(formatMoney(3000, 'ISK')).toBe('ISK 3,000')
  expect(formatMoney(-5, 'GBP')).toBe('−£5')
})

it('settle-up: 400 split evenly paid by a, 120 paid by b', () => {
  const b = balances([
    cost({ amount: 400, currency: 'EUR', status: 'paid', paid_by: 'a', split: 'even' }),
    cost({ amount: 120, currency: 'EUR', status: 'paid', paid_by: 'b', split: 'even' }),
  ], ['a', 'b'], R)
  expect(b.a).toBeCloseTo(140)
  expect(transfers(b)).toEqual([{ from: 'b', to: 'a', eur: 140 }])
})

it('a cost only for one person is owed in full by them', () => {
  const b = balances([cost({ amount: 30, status: 'paid', paid_by: 'a', split: 'b' })], ['a', 'b'], R)
  expect(transfers(b)).toEqual([{ from: 'b', to: 'a', eur: 30 }])
})

it('estimates never count in settle-up', () => {
  expect(transfers(balances([cost({ status: 'estimate', paid_by: 'a' })], ['a', 'b'], R))).toEqual([])
})

describe('fetchRates', () => {
  afterEach(() => vi.restoreAllMocks())

  it('uses a fresh cache without fetching', async () => {
    localStorage.setItem('rates', JSON.stringify({ at: Date.now() - 1000, value: R }))
    const f = vi.spyOn(globalThis, 'fetch')
    expect(await fetchRates()).toEqual(R)
    expect(f).not.toHaveBeenCalled()
  })

  it('fetches when stale and stores the result', async () => {
    localStorage.setItem('rates', JSON.stringify({ at: Date.now() - 3 * 86_400_000, value: R }))
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ date: '2026-11-05', base: 'EUR', rates: { SGD: 1.44 } })))
    expect(await fetchRates()).toEqual({ date: '2026-11-05', rates: { SGD: 1.44 } })
    expect(JSON.parse(localStorage.getItem('rates')!).value.date).toBe('2026-11-05')
  })

  it('falls back to a stale cache on failure', async () => {
    localStorage.setItem('rates', JSON.stringify({ at: Date.now() - 3 * 86_400_000, value: R }))
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'))
    expect(await fetchRates()).toEqual(R)
  })

  it('throws with no cache and no network', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'))
    await expect(fetchRates()).rejects.toThrow()
  })
})
