// what a screen shows while its data is on the way
export type Load = { state: 'ready' | 'loading' | 'offline' | 'failed'; stale: boolean; retry: () => void }
type Query = { data?: unknown; status?: string; fetchStatus?: string; refetch?: () => unknown }

export function loadState(...queries: Query[]): Load {
  const retry = () => { for (const q of queries) if (q.status === 'error') q.refetch?.() }
  const missing = queries.filter((q) => q.data === undefined)
  if (!missing.length) return { state: 'ready', stale: queries.some((q) => q.status === 'error'), retry }
  const state = missing.some((q) => q.status === 'error') ? 'failed'
    : missing.some((q) => q.fetchStatus === 'paused') ? 'offline' : 'loading'
  return { state, stale: false, retry }
}
