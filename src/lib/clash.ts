import type { Stop, Trip } from './types'
import { isAncestor } from './countries'

export function clashes(trips: Trip[], stops: Stop[]): Set<string> {
  const bad = new Set<string>()
  const stays = stops.filter((s) => s.kind === 'stay' && s.day && s.end_date && s.end_date > s.day)
  for (let i = 0; i < stays.length; i++) {
    for (let j = i + 1; j < stays.length; j++) {
      const a = stays[i], b = stays[j]
      const related = a.trip_id !== b.trip_id && (isAncestor(a.trip_id, b.trip_id, trips) || isAncestor(b.trip_id, a.trip_id, trips))
      if (!related && a.day! < b.end_date! && b.day! < a.end_date!) { bad.add(a.id); bad.add(b.id) }
    }
  }
  const byParent = new Map<string | null, Trip[]>()
  for (const t of trips) {
    if (!t.start_date || !t.end_date) continue
    const k = t.parent_id
    if (!byParent.has(k)) byParent.set(k, [])
    byParent.get(k)!.push(t)
  }
  for (const [parent, kids] of byParent) {
    if (parent === null) continue
    for (let i = 0; i < kids.length; i++) {
      for (let j = i + 1; j < kids.length; j++) {
        const a = kids[i], b = kids[j]
        if (a.start_date! < b.end_date! && b.start_date! < a.end_date!) { bad.add(a.id); bad.add(b.id) }
      }
    }
  }
  return bad
}
