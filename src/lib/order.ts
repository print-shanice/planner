export function positionsAfterMove(ids: string[], from: number, to: number, current?: number[]): { id: string; position: number }[] {
  const next = ids.slice()
  const [moved] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved)
  const was = new Map(ids.map((id, i) => [id, current ? current[i] : i]))
  return next.map((id, position) => ({ id, position })).filter((r) => was.get(r.id) !== r.position)
}
