import type { Cost } from './types'
import { toEur, type Rates } from './money'

// paying someone back: it squares a debt and is never spending
export const isPayback = (c: Cost) => c.category === 'repayment'

// who a cost is for: its own list, else (older rows) everyone or the one person
function sharers(c: Cost, members: string[]): string[] {
  if (c.split_among?.length) return c.split_among
  if (c.split && c.split !== 'even') return [c.split]
  return members.length ? members : [c.paid_by!]
}

export function balances(costs: Cost[], members: string[], rates: Rates | null): Record<string, number> {
  const bal: Record<string, number> = {}
  const add = (who: string, v: number) => { bal[who] = (bal[who] ?? 0) + v }
  for (const c of costs) {
    if (c.status !== 'paid' || !c.paid_by) continue
    const eur = toEur(c.amount, c.currency, rates, c.eur_rate)
    if (eur == null || !Number.isFinite(eur)) continue
    add(c.paid_by, eur)
    const shares = c.split_amounts && Object.keys(c.split_amounts).length ? c.split_amounts : null
    if (shares && c.amount) {
      for (const [who, part] of Object.entries(shares)) add(who, -eur * (Number(part) / c.amount))
      continue
    }
    const who = sharers(c, members)
    for (const m of who) add(m, -eur / who.length)
  }
  return bal
}

export function transfers(bal: Record<string, number>): { from: string; to: string; eur: number }[] {
  const pos = Object.entries(bal).filter(([, v]) => v > 0.005).sort((a, b) => b[1] - a[1])
  const neg = Object.entries(bal).filter(([, v]) => v < -0.005).map(([k, v]) => [k, -v] as [string, number]).sort((a, b) => b[1] - a[1])
  const out: { from: string; to: string; eur: number }[] = []
  let i = 0, j = 0
  while (i < neg.length && j < pos.length) {
    const m = Math.min(neg[i][1], pos[j][1])
    out.push({ from: neg[i][0], to: pos[j][0], eur: Math.round(m * 100) / 100 })
    neg[i][1] -= m; pos[j][1] -= m
    if (neg[i][1] < 0.005) i++
    if (pos[j][1] < 0.005) j++
  }
  return out
}
