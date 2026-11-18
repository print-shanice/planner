import type { Bag, PackingItem } from './types'

// people: the members' user ids. view: the person picked at the top, or null for everyone.
// a thing with no owner is shared: each person ticks it for themselves.

const whoFor = (p: PackingItem, people: string[]) => (p.owner ? [p.owner] : people)

// who has packed it; a row from before owners existed reads its old tick as everyone's
export const packedBy = (p: PackingItem, people: string[]): string[] => p.packed_by ?? (p.done ? whoFor(p, people) : [])

export const shows = (p: PackingItem, view: string | null) => !view || !p.owner || p.owner === view

// packed for the person looking, or (nobody picked) for everyone it's for
export function isPacked(p: PackingItem, view: string | null, people: string[]): boolean {
  const by = packedBy(p, people)
  if (p.owner) return by.includes(p.owner)
  if (view) return by.includes(view)
  return people.length > 0 && people.every((x) => by.includes(x))
}

// whose tick a press is: the owner's, else the person picked, else mine
export const tickFor = (p: PackingItem, view: string | null, me: string | null) => p.owner ?? view ?? me

// packed_by after a press for that person; not knowing who, a shared thing ticks for everyone at once
export function toggled(p: PackingItem, who: string | null, people: string[]): string[] {
  const by = packedBy(p, people)
  if (!who) return isPacked(p, null, people) ? [] : [...whoFor(p, people)]
  return by.includes(who) ? by.filter((x) => x !== who) : [...by, who]
}

// how many: a number in front ("3 black tees") or a ×n at the end ("socks ×7", "socks x7"); 1 to 99.
// a number that's part of the name ("24h adapter", "cable 2m") stays in it
export function parseQty(typed: string): { text: string; qty: number } {
  const t = typed.trim()
  const front = /^(\d{1,2})\s+(\S.*)$/.exec(t)
  const back = /^(.*\S)\s*[×x*]\s*(\d{1,2})$/i.exec(t)
  const m = front ? { n: +front[1], rest: front[2] } : back ? { n: +back[2], rest: back[1] } : null
  return m && m.n >= 1 ? { text: m.rest.trim(), qty: m.n } : { text: t, qty: 1 }
}

export const qtyOf = (p: PackingItem) => p.qty ?? 1
export const qtyLabel = (p: PackingItem) => (qtyOf(p) > 1 ? `×${qtyOf(p)}` : '')

export type PackGroup = { pack: PackingItem; things: PackingItem[] }

// packs in order, each with its things in order, and the loose things; things whose pack isn't here are left out
export function arrange(items: PackingItem[]): { packs: PackGroup[]; loose: PackingItem[] } {
  const byPos = (a: PackingItem, b: PackingItem) => a.position - b.position
  const sorted = [...items].sort(byPos)
  const packs = sorted.filter((p) => p.is_pack).map((pack) => ({ pack, things: sorted.filter((t) => t.parent_id === pack.id) }))
  return { packs, loose: sorted.filter((p) => !p.is_pack && !p.parent_id) }
}

// how many are packed of how many there are, counting each thing's number
export function tally(things: PackingItem[], packed: (p: PackingItem) => boolean): { done: number; total: number } {
  return things.reduce((n, p) => ({ done: n.done + (packed(p) ? qtyOf(p) : 0), total: n.total + qtyOf(p) }), { done: 0, total: 0 })
}

// the bag a thing goes in: a thing inside a pack goes in its pack's
export function bagOf(p: PackingItem, byId: Map<string, PackingItem>): Bag | null {
  const pack = p.parent_id ? byId.get(p.parent_id) : null
  return (pack ? pack.bag : p.bag) ?? null
}
