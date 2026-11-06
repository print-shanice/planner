import { renderHook, act } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { persistQueryClientSave, persistQueryClientRestore } from '@tanstack/react-query-persist-client'

const auth = vi.hoisted(() => ({ status: 'signed-in' as string }))
vi.mock('../../src/lib/auth', () => ({ useAuth: () => ({ status: auth.status }) }))
vi.mock('../../src/lib/supabase', () => ({ supabase: {} }))

import { persister, useOnline, useCanEdit, forgetDevice } from '../../src/lib/offline'
import { getTicket, putTicket } from '../../src/lib/ticketCache'
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
  await forgetDevice(qc)
  expect(qc.getQueryData(keys.trips)).toBeUndefined()
  const again = new QueryClient()
  await persistQueryClientRestore({ queryClient: again, persister })
  expect(again.getQueryData(keys.trips)).toBeUndefined()
  expect(await getTicket('f1')).toBeNull()
})
