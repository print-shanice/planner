import type { PackingItem } from './types'

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
