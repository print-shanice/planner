import type { Rates } from './money'

const KEY = 'rates'
const MAX_AGE = 86_400_000
export const RATES_URL = 'https://api.frankfurter.dev/v1/latest?from=EUR'

function readCache(): { at: number; value: Rates } | null {
  try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') } catch { return null }
}

export async function fetchRates(): Promise<Rates> {
  const cached = readCache()
  if (cached && Date.now() - cached.at < MAX_AGE) return cached.value
  try {
    const res = await fetch(RATES_URL)
    if (!res.ok) throw new Error(`rates ${res.status}`)
    const json = await res.json()
    const value: Rates = { date: json.date, rates: json.rates }
    try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), value })) } catch { /* storage full */ }
    return value
  } catch (e) {
    if (cached) return cached.value
    throw e
  }
}

export function currencyList(rates: Rates | null): string[] {
  const first = ['EUR', 'SGD', 'GBP', 'USD', 'CHF']
  const rest = Object.keys(rates?.rates ?? {}).filter((c) => !first.includes(c)).sort()
  return [...first, ...rest]
}
