import { useSyncExternalStore } from 'react'

// the places the places tab is showing right now (after its search and kind filter), so the map beside it shows the same.
// null: the tab isn't open, and the map shows its own ideas
let now: string[] | null = null
const listeners = new Set<() => void>()

export function setShownPlaces(ids: string[] | null) {
  if (ids === now || (ids && now && ids.length === now.length && ids.every((x, i) => x === now![i]))) return
  now = ids
  for (const l of listeners) l()
}

export const shownPlaces = (): string[] | null => now
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
export const useShownPlaces = (): string[] | null => useSyncExternalStore(subscribe, () => now, () => null)
