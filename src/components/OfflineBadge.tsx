import { useOnline } from '../lib/offline'

export function OfflineBadge({ inline = false }: { inline?: boolean }) {
  return useOnline() ? null : <span className={inline ? 'pill warn' : 'pill warn offline-badge'} role="status">offline</span>
}
