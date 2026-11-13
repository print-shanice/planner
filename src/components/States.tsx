import type { Load } from '../lib/load'
import { EmptyState } from './EmptyState'
import { Loading } from './Loading'

export function LoadNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="notice" role="alert">
      <span className="notice-text">couldn't load</span>
      <button type="button" className="btn ghost small" onClick={onRetry}>retry</button>
    </div>
  )
}

// not ready: the whole view; ready: a "couldn't load" line over the saved copy when the refresh failed
export function LoadState({ load }: { load: Load }) {
  switch (load.state) {
    case 'loading': return <Loading />
    case 'offline': return <EmptyState title="offline" />
    case 'failed': return <LoadNotice onRetry={load.retry} />
    default: return load.stale ? <LoadNotice onRetry={load.retry} /> : null
  }
}
