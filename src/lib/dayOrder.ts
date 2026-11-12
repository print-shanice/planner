// the order of a day, the way a plan written in a doc reads: times decide, and each line without a time
// stays under the timed line above it ("12:34 explore shibuya", then the shops), so a time change moves them together

type Line = { id: string; time: string | null; position: number }

const timed = (t: string | null | undefined): t is string => !!t && /^\d{2}:\d{2}$/.test(t)

export function dayOrder<T extends Line>(lines: T[]): T[] {
  const byHand = [...lines].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
  const head: T[] = []
  const groups: T[][] = []
  for (const l of byHand) {
    if (timed(l.time)) groups.push([l])
    else if (groups.length) groups[groups.length - 1].push(l)
    else head.push(l)
  }
  // a stable sort: equal times keep the order they were put in
  groups.sort((a, b) => a[0].time!.localeCompare(b[0].time!))
  return head.concat(...groups)
}

// where a new line goes: with a time, after everything at or before it (its untimed lines too); without, at the end
export function insertAt(ordered: { time: string | null }[], time: string | null): number {
  if (!timed(time)) return ordered.length
  const later = ordered.findIndex((l) => timed(l.time) && l.time > time)
  return later < 0 ? ordered.length : later
}

// a timed line fits where it stands when nothing above it is later and nothing below it earlier
export function fitsTime(ordered: { id: string; time: string | null }[], id: string): boolean {
  const at = ordered.findIndex((l) => l.id === id)
  const me = ordered[at]
  if (!me || !timed(me.time)) return true
  return ordered.every((l, i) => !timed(l.time) || (i < at ? l.time <= me.time! : i > at ? l.time >= me.time! : true))
}

// positions that make the stored order the order shown; only the ones that change are sent
export function renumber(ordered: { id: string; position: number }[]): { id: string; position: number }[] {
  return ordered.flatMap((l, position) => (l.position === position ? [] : [{ id: l.id, position }]))
}
