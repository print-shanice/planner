import { useOnline } from '../lib/offline'

export function OfflineBadge() {
  return useOnline() ? null : <span className="pill warn offline-badge" role="status">offline</span>
}
