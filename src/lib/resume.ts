import type { Stop, Trip } from './types'
import { chosenDay } from './agenda'
import { byStart } from './dates'

const KEY = 'planner-resume'
export type PlanningContext = { tripId: string; day: string | null }

export function rememberPlan(context: PlanningContext): void {
  try { localStorage.setItem(KEY, JSON.stringify(context)) } catch { /* private storage: navigation still works */ }
}

export function resumePlan(trips: Trip[], stops: Stop[], today: string): PlanningContext | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? 'null') as PlanningContext | null
    const trip = trips.find(t => t.id === value?.tripId)
    if (trip) return { tripId: trip.id, day: chosenDay(trip, trips, stops, typeof value?.day === 'string' ? value.day : null, today) }
  } catch { /* stale or unavailable storage: use the next trip */ }
  const trip = trips.filter(t => !t.parent_id && (!t.end_date || t.end_date >= today)).sort(byStart)[0]
  return trip ? { tripId: trip.id, day: chosenDay(trip, trips, stops, null, today) } : null
}

export function forgetResume(): void {
  try { localStorage.removeItem(KEY) } catch { /* storage unavailable */ }
}
