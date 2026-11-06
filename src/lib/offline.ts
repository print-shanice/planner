import { useSyncExternalStore } from 'react'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { del, get, set } from 'idb-keyval'
import type { QueryClient } from '@tanstack/react-query'
import { useAuth } from './auth'
import { clearTickets } from './ticketCache'
import { pausePersist, persistPaused } from './wipe'
import { forgetPending } from './pending'

export const persister = createAsyncStoragePersister({
  storage: {
    getItem: (k: string) => get<string>(k).then((v) => v ?? null),
    setItem: (k: string, v: string) => (persistPaused() ? Promise.resolve() : set(k, v)),
    removeItem: (k: string) => del(k),
  },
  key: 'planner-cache',
  throttleTime: 1000,
})

export const MAX_AGE = 30 * 24 * 60 * 60 * 1000

function subscribe(cb: () => void) {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

let online = typeof navigator === 'undefined' ? true : navigator.onLine
function snapshot() { return online }
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { online = true })
  window.addEventListener('offline', () => { online = false })
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => true)
}

export function useCanEdit(): boolean {
  const on = useOnline()
  const { status } = useAuth()
  return on && status === 'signed-in'
}

// after signing out, nothing from the plan stays on this device
export async function forgetDevice(qc: QueryClient): Promise<void> {
  pausePersist()
  qc.clear()
  forgetPending()
  await Promise.allSettled([persister.removeClient(), clearTickets()])
}
