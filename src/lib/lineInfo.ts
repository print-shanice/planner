import type { Cost, Link, Stop } from './types'
import { formatMoney } from './money'
import { hostOf, safeUrl } from './embed'
import { statusWord } from './flight'

export type LineInfo = {
  note: string | null
  ref: string | null
  tickets: number
  cost: { text: string; paid: boolean } | null
  links: { url: string; label: string }[]
  // a flight's terminal and gate, or what went wrong (warn)
  flight: { text: string; warn: boolean } | null
}

export const NO_INFO: LineInfo = { note: null, ref: null, tickets: 0, cost: null, links: [], flight: null }

function flightBit(s: Stop): LineInfo['flight'] {
  const f = s.kind === 'journey' && s.mode === 'flight' ? s.flight : null
  if (!f) return null
  const word = statusWord(f)
  if (word?.warn) return word
  const where = [f.dep.terminal && `t${f.dep.terminal.toLowerCase()}`, f.dep.gate && `gate ${f.dep.gate.toLowerCase()}`].filter(Boolean).join(' · ')
  return where ? { text: where, warn: false } : null
}

// what a plan line holds beyond its name, so nothing on its card is a surprise
export function lineInfo(s: Stop, has: { files: number; costs: Cost[]; links: Link[] }): LineInfo {
  const note = s.kind === 'note' ? null : (s.notes ?? '').split('\n').map((l) => l.trim()).find(Boolean) ?? null
  const ref = s.kind === 'journey' ? null : s.ref?.trim() || null
  let cost: LineInfo['cost'] = null
  if (has.costs.length) {
    const one = has.costs.every((c) => c.currency === has.costs[0].currency)
    cost = {
      text: one ? formatMoney(has.costs.reduce((n, c) => n + c.amount, 0), has.costs[0].currency) : `${has.costs.length} costs`,
      paid: has.costs.every((c) => c.status === 'paid'),
    }
  }
  const own = safeUrl(s.url)
  const links = [
    ...(own ? [{ url: own, label: hostOf(own) }] : []),
    ...has.links.flatMap((l) => { const url = safeUrl(l.url); return url ? [{ url, label: l.title || hostOf(url) }] : [] }),
  ]
  return { note, ref, tickets: has.files, cost, links, flight: flightBit(s) }
}
