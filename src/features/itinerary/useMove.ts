import type { Stop, Trip } from '../../lib/types'
import { useCosts, useRemove, useSave, useStops, useTrips } from '../../lib/queries'
import { moveChanges, type Move } from '../../lib/move'
import { useToast } from '../../components/Toast'
import { flash } from './flash'

type Opts = { fresh?: boolean; said?: string }

// puts a line down on a day, before another line (or last), and saves what that changes.
// a time that no longer fits is cleared, and the toast says so with undo. fresh: a new line (from the map)
export function useMove(trip: Trip): (stop: Stop, toDay: string, before: string | null, opts?: Opts) => Move {
  const save = useSave('stops')
  const saveCost = useSave('costs')
  const remove = useRemove('stops')
  const stops = useStops().data ?? []
  const trips = useTrips().data ?? []
  const costs = useCosts().data ?? []
  const toast = useToast()
  return (stop, toDay, before, opts = {}) => {
    const out = moveChanges(stop, toDay, before, { top: trip, trips, stops, costs })
    const others = opts.fresh ? out.changes.filter((c) => c.id !== stop.id) : out.changes
    if (opts.fresh) save.mutate({ ...out.moved })
    for (const c of others) save.mutate(c)
    for (const c of out.costs) saveCost.mutate(c)
    if (opts.fresh || out.changes.length) flash(stop.id)
    // undo puts every changed field back the way it was
    const undo = () => {
      if (opts.fresh) remove.mutate(stop.id)
      for (const c of others) {
        const was = stops.find((s) => s.id === c.id)
        if (!was) continue
        const back: Record<string, unknown> = { id: c.id }
        for (const k of Object.keys(c)) if (k !== 'id') back[k] = was[k as keyof Stop]
        save.mutate(back as Partial<Stop> & { id: string })
      }
      for (const c of out.costs) {
        const was = costs.find((x) => x.id === c.id)
        if (was) saveCost.mutate({ id: c.id, trip_id: was.trip_id })
      }
    }
    if (out.cleared) toast.show({ text: `${out.cleared} cleared to keep the day in time order`, undo })
    else if (opts.said) toast.show({ text: opts.said, undo })
    return out
  }
}
