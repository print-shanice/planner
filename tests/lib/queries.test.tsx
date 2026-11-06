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
    handlers, channel, insert, update, updEq, eq, single,
    supabase: {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
      from: vi.fn(() => ({ insert, update, delete: () => ({ eq }), select: () => Promise.resolve({ data: [], error: null }) })),
    },
  }
})
vi.mock('../../src/lib/supabase', () => ({ supabase: sb.supabase }))

import { RealtimeBridge } from '../../src/lib/realtime'
import { useSave, useRemove, useStops, keys } from '../../src/lib/queries'
import { useFailure, forgetPending, failSave, failureOf } from '../../src/lib/pending'

afterEach(() => { forgetPending(); sb.single.mockReset().mockImplementation(() => Promise.resolve({ data: { id: 'x' }, error: null })) })

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

it('a failed save stays on screen with its failure, and retry sends it again', async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const { result } = renderHook(() => ({ stops: useStops(), save: useSave('stops'), failed: useFailure('stops', 'n1') }), { wrapper: wrap(qc) })
  await waitFor(() => expect(result.current.stops.data).toEqual([]))
  sb.single.mockImplementationOnce(() => Promise.resolve({ data: null, error: { message: 'asleep' } }) as never)
  await act(async () => { await result.current.save.mutateAsync({ id: 'n1', title: 'arktikum' }).catch(() => {}) })
  // the server still has nothing, but the row stays
  await waitFor(() => expect(result.current.stops.data).toEqual([expect.objectContaining({ id: 'n1', title: 'arktikum' })]))
  expect(result.current.failed).toMatchObject({ isNew: true })
  sb.insert.mockClear()
  await act(async () => { await result.current.save.mutateAsync({ id: 'n1' }) })
  expect(sb.insert).toHaveBeenCalledWith(expect.objectContaining({ id: 'n1', title: 'arktikum' }))
  expect(result.current.failed).toBeUndefined()
})

it('a later save of a row whose insert failed is sent as that insert', async () => {
  const qc = new QueryClient()
  qc.setQueryData(keys.packing, [])
  const { result } = renderHook(() => useSave('packing'), { wrapper: wrap(qc) })
  sb.single.mockImplementationOnce(() => Promise.resolve({ data: null, error: { message: 'asleep' } }) as never)
  await act(async () => { await result.current.mutateAsync({ id: 'p1', text: 'socks', done: false }).catch(() => {}) })
  // the optimistic row is in the cache, so this would otherwise go as an update
  qc.setQueryData(keys.packing, [{ id: 'p1', text: 'socks', done: false }])
  sb.insert.mockClear(); sb.update.mockClear()
  await act(async () => { await result.current.mutateAsync({ id: 'p1', done: true }) })
  expect(sb.update).not.toHaveBeenCalled()
  expect(sb.insert).toHaveBeenCalledWith({ id: 'p1', text: 'socks', done: true })
})

const asleep = () => Promise.resolve({ data: null, error: { message: 'asleep' } }) as never

it('removing a row whose save failed forgets that save for good', async () => {
  const qc = new QueryClient()
  qc.setQueryData(keys.packing, [])
  failSave('packing', 'p1', { text: 'socks' }, true)
  const { result } = renderHook(() => useRemove('packing'), { wrapper: wrap(qc) })
  await act(async () => { await result.current.mutateAsync('p1') })
  expect(failureOf('packing', 'p1')).toBeUndefined()
})

it('a failed trip edit is not kept, since nothing on screen would say so', async () => {
  const qc = new QueryClient()
  qc.setQueryData(keys.trips, [{ id: 't1', name: 'lapland' }])
  const { result } = renderHook(() => useSave('trips'), { wrapper: wrap(qc) })
  sb.single.mockImplementationOnce(asleep)
  await act(async () => { await result.current.mutateAsync({ id: 't1', name: 'lapland 2' }).catch(() => {}) })
  expect(failureOf('trips', 't1')).toBeUndefined()
})

it('a delete that fails puts the row back where it was, even if the refresh fails too', async () => {
  const qc = new QueryClient()
  qc.setQueryData(keys.stops, [{ id: 's1' }, { id: 's2' }, { id: 's3' }])
  sb.eq.mockImplementationOnce(() => Promise.resolve({ error: { message: 'asleep' } }) as never)
  const { result } = renderHook(() => useRemove('stops'), { wrapper: wrap(qc) })
  await act(async () => { await result.current.mutateAsync('s2').catch(() => {}) })
  expect(qc.getQueryData(keys.stops)).toEqual([{ id: 's1' }, { id: 's2' }, { id: 's3' }])
})
