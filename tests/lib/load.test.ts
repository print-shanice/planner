import { loadState } from '../../src/lib/load'

const ok = (data: unknown = []) => ({ data, status: 'success', fetchStatus: 'idle' })

it('data everywhere is ready', () => {
  expect(loadState(ok(), ok([1]))).toMatchObject({ state: 'ready', stale: false })
})

it('a failed refresh over saved data is ready but stale, and retry refetches only what failed', () => {
  const good = { ...ok(), refetch: vi.fn() }
  const bad = { data: [1], status: 'error', fetchStatus: 'idle', refetch: vi.fn() }
  const l = loadState(good, bad)
  expect(l).toMatchObject({ state: 'ready', stale: true })
  l.retry()
  expect(bad.refetch).toHaveBeenCalled()
  expect(good.refetch).not.toHaveBeenCalled()
})

it('no data yet while fetching is loading', () => {
  expect(loadState(ok(), { status: 'pending', fetchStatus: 'fetching' }).state).toBe('loading')
})

it('no data while the device restores its copy is loading', () => {
  expect(loadState({ status: 'pending', fetchStatus: 'idle' }).state).toBe('loading')
})

it('paused query is offline', () => {
  expect(loadState({ status: 'pending', fetchStatus: 'paused' }).state).toBe('offline')
})

it('no data and an error is failed', () => {
  expect(loadState({ status: 'error', fetchStatus: 'idle' }, { status: 'pending', fetchStatus: 'fetching' }).state).toBe('failed')
})
