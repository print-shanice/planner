import type { Load } from '../lib/load'
import { EmptyState } from './EmptyState'
import { Loading } from './Loading'

// anything still loading shows totoro (blocks is kept for older callers; the animation is the same everywhere)
export function Skeleton(_: { blocks?: number }) {
  return <Loading />
}

export function LoadNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="notice" role="alert">
      <span className="notice-text">couldn't load</span>
      <button type="button" className="btn ghost small" onClick={onRetry}>retry</button>
    </div>
  )
}

// not ready: the whole view; ready: a "couldn't load" line over the saved copy when the refresh failed
export function LoadState({ load, blocks }: { load: Load; blocks?: number }) {
  switch (load.state) {
    case 'loading': return <Skeleton blocks={blocks} />
    case 'offline': return <EmptyState title="offline" />
    case 'failed': return <LoadNotice onRetry={load.retry} />
    default: return load.stale ? <LoadNotice onRetry={load.retry} /> : null
  }
}
