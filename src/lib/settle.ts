import type { Cost, Member } from './types'
import { toEur, type Rates } from './money'

// paying someone back: it squares a debt and is never spending
export const isPayback = (c: Cost) => c.category === 'repayment'

// the people a cost names as its own: its list, else (older rows) the one person in split. null: everyone
export const namedSharers = (c: Pick<Cost, 'split' | 'split_among'>): string[] | null =>
  c.split_among?.length ? c.split_among : c.split && c.split !== 'even' ? [c.split] : null

// exact shares, in the cost's own currency, when it was split by amounts
export const exactShares = (c: Pick<Cost, 'split_amounts'>): Record<string, number> | null =>
  c.split_amounts && Object.keys(c.split_amounts).length ? c.split_amounts : null

// who a cost is for: the people it names, else everyone (or, with nobody known, whoever paid)
const sharers = (c: Cost, members: string[]): string[] => namedSharers(c) ?? (members.length ? members : [c.paid_by!])

// who a cost is for, in a few words
export function splitLine(c: Cost, members: Member[]): string {
  const who = (id: string) => members.find((m) => m.user_id === id)?.name ?? 'someone'
  if (exactShares(c)) return 'exact amounts'
  const among = namedSharers(c)
  const everyone = members.filter((m) => m.user_id).map((m) => m.user_id!)
  if (!among || (among.length === everyone.length && among.every((x) => everyone.includes(x)))) return 'split evenly'
  return among.length === 1 ? `only for ${who(among[0])}` : `for ${among.map(who).join(' and ')}`
}

export function balances(costs: Cost[], members: string[], rates: Rates | null): Record<string, number> {
  const bal: Record<string, number> = {}
  const add = (who: string, v: number) => { bal[who] = (bal[who] ?? 0) + v }
  for (const c of costs) {
    if (c.status !== 'paid' || !c.paid_by) continue
    const eur = toEur(c.amount, c.currency, rates, c.eur_rate)
    if (eur == null || !Number.isFinite(eur)) continue
    add(c.paid_by, eur)
    const shares = exactShares(c)
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

export type Standing = { id: string; paid: number; share: number; balance: number }
const cents = (v: number) => Math.round(v * 100) / 100

// what each person put in, what their share of the spending was, and where that leaves them (in eur).
// members first, in their order, then anyone else named on a cost
export function standings(costs: Cost[], members: string[], rates: Rates | null): Standing[] {
  const paid: Record<string, number> = {}
  const share: Record<string, number> = {}
  const add = (into: Record<string, number>, who: string, v: number) => { into[who] = (into[who] ?? 0) + v }
  const spending = costs.filter((c) => !isPayback(c))
  for (const c of spending) {
    if (c.status !== 'paid' || !c.paid_by) continue
    const eur = toEur(c.amount, c.currency, rates, c.eur_rate)
    if (eur == null || !Number.isFinite(eur)) continue
    add(paid, c.paid_by, eur)
  }
  // a share is what balances() takes off each person, so the two always agree
  const owed = balances(spending, members, rates)
  for (const who of Object.keys(owed)) share[who] = (paid[who] ?? 0) - owed[who]
  const bal = balances(costs, members, rates)
  const ids = [...new Set([...members, ...Object.keys(bal)])]
  return ids.map((id) => ({ id, paid: cents(paid[id] ?? 0), share: cents(share[id] ?? 0), balance: cents(bal[id] ?? 0) + 0 }))
}
