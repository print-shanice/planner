import type { Cost, Stop, Trip } from './types'
import { ancestors, descendants } from './countries'
import { addDays, daysBetween } from './dates'
import { ownerOn } from './agenda'
import { dayOrder, fitsTime } from './dayOrder'

export type MoveCtx = { top: Trip; trips: Trip[]; stops: Stop[]; costs: Cost[] }
export type Change = Partial<Stop> & { id: string }
export type Move = { changes: Change[]; costs: { id: string; trip_id: string }[]; cleared: string | null; moved: Stop }

const FIELDS = ['day', 'end_date', 'trip_id', 'saved', 'time', 'end_time', 'position'] as const

// a line put down on a day, before another line (or last): what has to change. where you put it wins:
// a time that no longer fits there is cleared (and reported, so it can be undone). a line moving to a day inside
// a side trip joins the side trip, its costs with it. both days close up their positions
export function moveChanges(stop: Stop, toDay: string, before: string | null, ctx: MoveCtx): Move {
  const root = ancestors(ctx.top.id, ctx.trips)[0] ?? ctx.top
  const family = new Set(descendants(root.id, ctx.trips))
  // an untimed check-in ends its day by itself, so it holds no place among the lines
  const placed = (s: Stop) => s.kind !== 'stay' || !!s.time
  const linesOn = (d: string) => dayOrder(ctx.stops.filter((s) => family.has(s.trip_id) && s.day === d && placed(s) && s.id !== stop.id))

  const target = linesOn(toDay)
  let at = before ? target.findIndex((s) => s.id === before) : -1
  if (at < 0) at = target.length
  const newDay = stop.day !== toDay
  const moved: Stop = { ...stop, day: toDay }
  if (newDay) moved.trip_id = ownerOn(ctx.top, ctx.trips, toDay).id
  if (newDay && stop.day && stop.end_date) moved.end_date = addDays(stop.end_date, daysBetween(stop.day, toDay))
  if (!stop.day || stop.saved) moved.saved = false
  const order = [...target.slice(0, at), moved, ...target.slice(at)]
  let cleared: string | null = null
  if (moved.time && !fitsTime(order, moved.id)) {
    cleared = moved.time
    moved.time = null
    moved.end_time = null
  }

  const changes: Change[] = []
  order.forEach((l, i) => {
    if (l !== moved) { if (l.position !== i) changes.push({ id: l.id, position: i }); return }
    moved.position = i
    const diff: Change = { id: stop.id }
    for (const k of FIELDS) if (moved[k] !== stop[k]) (diff as Record<string, unknown>)[k] = moved[k]
    if (Object.keys(diff).length > 1) changes.push(diff)
  })
  if (newDay && stop.day) linesOn(stop.day).forEach((l, i) => { if (l.position !== i) changes.push({ id: l.id, position: i }) })
  const costs = moved.trip_id !== stop.trip_id
    ? ctx.costs.filter((c) => c.stop_id === stop.id).map((c) => ({ id: c.id, trip_id: moved.trip_id }))
    : []
  return { changes, costs, cleared, moved }
}
