import { renderHook, act } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { persistQueryClientSave, persistQueryClientRestore, persistQueryClientSubscribe } from '@tanstack/react-query-persist-client'
import { get } from 'idb-keyval'

const auth = vi.hoisted(() => ({ status: 'signed-in' as string }))
vi.mock('../../src/lib/auth', () => ({ useAuth: () => ({ status: auth.status }) }))
vi.mock('../../src/lib/supabase', () => ({ supabase: {} }))

import { persister, useOnline, useCanEdit, forgetDevice, queryDefaults } from '../../src/lib/offline'
import { failSave, failureOf } from '../../src/lib/pending'
import { getTicket, putTicket } from '../../src/lib/ticketCache'
import { resumePersist } from '../../src/lib/wipe'
import { keys } from '../../src/lib/queries'

it('useOnline follows the browser events', () => {
  const { result } = renderHook(() => useOnline())
  act(() => { window.dispatchEvent(new Event('offline')) })
  expect(result.current).toBe(false)
  act(() => { window.dispatchEvent(new Event('online')) })
  expect(result.current).toBe(true)
})

it('useCanEdit is false offline and true back online', () => {
  const { result } = renderHook(() => useCanEdit())
  act(() => { window.dispatchEvent(new Event('offline')) })
  expect(result.current).toBe(false)
  act(() => { window.dispatchEvent(new Event('online')) })
  expect(result.current).toBe(true)
})

it('useCanEdit is false when signed out', () => {
  auth.status = 'signed-out'
  const { result } = renderHook(() => useCanEdit())
  expect(result.current).toBe(false)
  auth.status = 'signed-in'
})

it('the cache survives a reload via IndexedDB', async () => {
  const a = new QueryClient()
  a.setQueryData(keys.trips, [{ id: 't1', name: 'lapland' }])
  await persistQueryClientSave({ queryClient: a, persister })
  const b = new QueryClient()
  await persistQueryClientRestore({ queryClient: b, persister })
  expect(b.getQueryData(keys.trips)).toEqual([{ id: 't1', name: 'lapland' }])
})

it('forgetDevice empties the cache, the saved copy and the tickets', async () => {
  const qc = new QueryClient()
  qc.setQueryData(keys.trips, [{ id: 't1', name: 'lapland' }])
  await persistQueryClientSave({ queryClient: qc, persister })
  await putTicket('f1', new Blob(['ticket'], { type: 'text/plain' }))
  failSave('stops', 's1', { title: 'x' }, false)
  await forgetDevice(qc)
  expect(failureOf('stops', 's1')).toBeUndefined()
  expect(qc.getQueryData(keys.trips)).toBeUndefined()
  const again = new QueryClient()
  await persistQueryClientRestore({ queryClient: again, persister })
  expect(again.getQueryData(keys.trips)).toBeUndefined()
  expect(await getTicket('f1')).toBeNull()
})

it('a save running while the device is wiped cannot put the plan back', async () => {
  const qc = new QueryClient()
  for (const k of Object.values(keys)) qc.setQueryData(k, [{ id: 'x' }])
  // let the persister's throttle go idle, as it is in the app before someone signs out
  await new Promise((r) => setTimeout(r, 1100))
  // the app keeps this subscription mounted through PersistQueryClientProvider
  const unsubscribe = persistQueryClientSubscribe({ queryClient: qc, persister })
  await forgetDevice(qc)
  expect(await get('planner-cache')).toBeUndefined()
  await new Promise((r) => setTimeout(r, 1100))
  expect(await get('planner-cache')).toBeUndefined()
  unsubscribe()
  resumePersist()
})

it('the saved copy restored on start stays until something uses it', async () => {
  const seed = new QueryClient()
  seed.setQueryData(keys.stops, [{ id: 's1', title: 'arktikum' }])
  await persistQueryClientSave({ queryClient: seed, persister })
  const qc = new QueryClient({ defaultOptions: queryDefaults })
  await persistQueryClientRestore({ queryClient: qc, persister })
  // nothing observes it yet; a garbage-collect timer must not throw it away
  await new Promise((r) => setTimeout(r, 50))
  expect(qc.getQueryData(keys.stops)).toEqual([{ id: 's1', title: 'arktikum' }])
})

it('opening the app offline counts as offline for the data too', async () => {
  const was = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine')!
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
  try {
    vi.resetModules()
    const { onlineManager } = await import('@tanstack/react-query')
    await import('../../src/lib/offline')
    expect(onlineManager.isOnline()).toBe(false)
  } finally {
    delete (navigator as unknown as Record<string, unknown>).onLine
    Object.defineProperty(Navigator.prototype, 'onLine', was)
  }
})
