import type { Stop } from './types'

// the position after the last of a trip's lines on that day (null: its ideas), leaving out the one being placed
export const nextPosition = (stops: Stop[], tripId: string, day: string | null, not?: string): number =>
  Math.max(-1, ...stops.filter((s) => s.trip_id === tripId && (s.day ?? null) === day && s.id !== not).map((s) => s.position)) + 1
