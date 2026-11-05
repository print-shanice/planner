import { renderHook, render, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const sb = vi.hoisted(() => {
  const handlers: Record<string, () => void> = {}
  const channel = {
    on: vi.fn((_e: string, f: { table: string }, cb: () => void) => { handlers[f.table] = cb; return channel }),
    subscribe: vi.fn(() => channel),
  }
  const single = vi.fn(() => Promise.resolve({ data: { id: 'x' }, error: null }))
  const insert = vi.fn(() => ({ select: () => ({ single }) }))
  const updEq = vi.fn(() => ({ select: () => ({ single }) }))
  const update = vi.fn(() => ({ eq: updEq }))
  const eq = vi.fn(() => Promise.resolve({ error: null }))
  return {
    handlers, channel, insert, update, updEq, eq,
    supabase: {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
      from: vi.fn(() => ({ insert, update, delete: () => ({ eq }), select: () => Promise.resolve({ data: [], error: null }) })),
    },
  }
})
vi.mock('../../src/lib/supabase', () => ({ supabase: sb.supabase }))

import { RealtimeBridge } from '../../src/lib/realtime'
import { useSave, useRemove, keys } from '../../src/lib/queries'

function wrap(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

it('a realtime change on stops invalidates only the stops query', () => {
  const qc = new QueryClient()
  const spy = vi.spyOn(qc, 'invalidateQueries')
  render(<RealtimeBridge />, { wrapper: wrap(qc) })
  act(() => sb.handlers.stops())
  expect(spy).toHaveBeenCalledTimes(1)
  expect(spy).toHaveBeenCalledWith({ queryKey: keys.stops })
})

it('useSave gives new rows an id, shows them at once, and refreshes', async () => {
  const qc = new QueryClient()
  qc.setQueryData(keys.stops, [])
  const spy = vi.spyOn(qc, 'invalidateQueries')
  const { result } = renderHook(() => useSave('stops'), { wrapper: wrap(qc) })
  let pending!: Promise<unknown>
  act(() => { pending = result.current.mutateAsync({ kind: 'place', title: 'arktikum' }) })
  await waitFor(() => expect((qc.getQueryData(keys.stops) as any[]).length).toBe(1))
  await act(async () => { await pending })
  const payload = (sb.insert.mock.calls[0] as any[])[0]
  expect(typeof payload.id).toBe('string')
  expect(payload.title).toBe('arktikum')
  expect(spy).toHaveBeenCalledWith({ queryKey: keys.stops })
})

it('useSave sends only the changed fields of an existing row', async () => {
  const qc = new QueryClient()
  qc.setQueryData(keys.stops, [{ id: 's1', title: 'arktikum', position: 0, notes: 'k wrote this' }])
  const { result } = renderHook(() => useSave('stops'), { wrapper: wrap(qc) })
  await act(async () => { await result.current.mutateAsync({ id: 's1', position: 3 }) })
  expect(sb.update).toHaveBeenCalledWith({ position: 3 })
  expect(sb.updEq).toHaveBeenCalledWith('id', 's1')
  expect((qc.getQueryData(keys.stops) as any[])[0]).toMatchObject({ title: 'arktikum', position: 3 })
})

it('useRemove deletes by id', async () => {
  const qc = new QueryClient()
  const { result } = renderHook(() => useRemove('stops'), { wrapper: wrap(qc) })
  await act(async () => { await result.current.mutateAsync('s1') })
  expect(sb.eq).toHaveBeenCalledWith('id', 's1')
})
