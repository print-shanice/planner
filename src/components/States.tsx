import type { Load } from '../lib/load'
import { EmptyState } from './EmptyState'

// grey stand-ins for cards; they fade in late, so a quick load from the device never flashes
export function Skeleton({ blocks = 2 }: { blocks?: number }) {
  return (
    <div className="skeleton" role="status" aria-label="loading">
      {Array.from({ length: blocks }, (_, i) => (
        <div key={i} className="skeleton-card" aria-hidden="true">
          <span className="bone w45" />
          <span className="bone" />
          <span className="bone w70" />
        </div>
      ))}
    </div>
  )
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
