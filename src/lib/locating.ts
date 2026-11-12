import { useSyncExternalStore } from 'react'

// the lines being looked up on the map right now (so each can say "finding the place")
const now = new Set<string>()
const listeners = new Set<() => void>()

export function setLocating(id: string, on: boolean) {
  if (on === now.has(id)) return
  if (on) now.add(id); else now.delete(id)
  for (const l of listeners) l()
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
export const useLocating = (id: string): boolean => useSyncExternalStore(subscribe, () => now.has(id), () => false)
