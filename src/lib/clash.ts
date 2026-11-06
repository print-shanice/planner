import type { Stop, Trip } from './types'
import { isAncestor } from './countries'

export type ClashSide = { id: string; name: string; tripId: string }
export type Clash = { kind: 'trip' | 'stay'; a: ClashSide; b: ClashSide; from: string; to: string }
type Span = { start: string; end: string; side: ClashSide }

// a starts first; from–to is the stretch both cover
function pair(kind: Clash['kind'], x: Span, y: Span): Clash {
  const [a, b] = x.start <= y.start ? [x, y] : [y, x]
  return { kind, a: a.side, b: b.side, from: b.start, to: a.end < b.end ? a.end : b.end }
}

// two stays at once (not a side trip's hotel inside its parent's home stay), or side trips of one parent that overlap
export function clashPairs(trips: Trip[], stops: Stop[]): Clash[] {
  const out: Clash[] = []
  const stays: Span[] = stops
    .filter((s) => s.kind === 'stay' && s.day && s.end_date && s.end_date > s.day)
    .sort((a, b) => a.day!.localeCompare(b.day!))
    .map((s) => ({ start: s.day!, end: s.end_date!, side: { id: s.id, name: s.title || s.place?.name || 'stay', tripId: s.trip_id } }))
  for (let i = 0; i < stays.length; i++) {
    for (let j = i + 1; j < stays.length; j++) {
      const a = stays[i], b = stays[j]
      const ta = a.side.tripId, tb = b.side.tripId
      const related = ta !== tb && (isAncestor(ta, tb, trips) || isAncestor(tb, ta, trips))
      if (!related && a.start < b.end && b.start < a.end) out.push(pair('stay', a, b))
    }
  }
  const byParent = new Map<string, Span[]>()
  for (const t of trips) {
    if (!t.parent_id || !t.start_date || !t.end_date) continue
    if (!byParent.has(t.parent_id)) byParent.set(t.parent_id, [])
    byParent.get(t.parent_id)!.push({ start: t.start_date, end: t.end_date, side: { id: t.id, name: t.name, tripId: t.id } })
  }
  for (const kids of byParent.values()) {
    for (let i = 0; i < kids.length; i++) {
      for (let j = i + 1; j < kids.length; j++) {
        const a = kids[i], b = kids[j]
        if (a.start < b.end && b.start < a.end) out.push(pair('trip', a, b))
      }
    }
  }
  return out
}

export function clashes(trips: Trip[], stops: Stop[]): Set<string> {
  const bad = new Set<string>()
  for (const c of clashPairs(trips, stops)) { bad.add(c.a.id); bad.add(c.b.id) }
  return bad
}
