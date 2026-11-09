import type { Cost } from './types'

export type Rates = { date: string; rates: Record<string, number> }

const rateOf = (cur: string, rates: Rates | null): number | null =>
  cur === 'EUR' ? 1 : rates?.rates[cur] ?? null

export function toEur(amount: number, currency: string, rates: Rates | null, manual: number | null): number | null {
  const r = rateOf(currency, rates) ?? manual
  return r ? amount / r : null
}

export function convert(amount: number, from: string, to: string, rates: Rates | null, manual: number | null = null): number | null {
  if (from === to) return amount
  const eur = toEur(amount, from, rates, manual)
  const r = rateOf(to, rates)
  return eur == null || !r ? null : eur * r
}

export type Totals = {
  paid: number
  planned: number
  leftOut: number
  byCategory: Record<string, { paid: number; planned: number }>
}

export function totals(costs: Cost[], cur: string, rates: Rates | null): Totals {
  const t: Totals = { paid: 0, planned: 0, leftOut: 0, byCategory: {} }
  for (const c of costs) {
    // paying someone back isn't spending
    if (!Number.isFinite(c.amount) || c.category === 'repayment') continue
    const v = convert(c.amount, c.currency, cur, rates, c.eur_rate)
    if (v == null || !Number.isFinite(v)) { t.leftOut++; continue }
    const b = (t.byCategory[c.category] ??= { paid: 0, planned: 0 })
    if (c.status === 'paid') { t.paid += v; b.paid += v } else { t.planned += v; b.planned += v }
  }
  return t
}

const SYM: Record<string, string> = { SGD: 'S$', EUR: '€', GBP: '£', USD: 'US$' }
const ZERO = new Set(['JPY', 'KRW', 'ISK', 'HUF', 'IDR'])

// totals read in whole units ({ whole: true }); a single cost keeps its cents
export function formatMoney(v: number, cur: string, opts?: { whole?: boolean; exact?: boolean }): string {
  if (opts?.whole) v = Math.round(v)
  const whole = opts?.whole || ZERO.has(cur) || (!opts?.exact && (Math.abs(v) >= 100 || Math.abs(v - Math.round(v)) < 0.005))
  const d = whole ? 0 : 2
  const n = Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d })
  return (v < -0.004 ? '−' : '') + (SYM[cur] ?? `${cur} `) + n
}

export const CATEGORIES: [string, string][] = [
  ['stays', 'stays'], ['transport', 'transport'], ['food', 'food & drink'],
  ['activities', 'sights & activities'], ['shopping', 'shopping'], ['other', 'other'],
]
