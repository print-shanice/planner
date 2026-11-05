import { useQuery } from '@tanstack/react-query'
import type { Place } from '../../lib/types'
import { walkKey, walkLabel, walkSeconds } from '../../lib/walk'
import { Icon } from '../../components/Icon'

export function WalkLeg({ from, to }: { from: Place; to: Place }) {
  const key = walkKey(from, to)
  const { data } = useQuery({
    queryKey: ['walk', key],
    queryFn: () => walkSeconds(from, to),
    enabled: !!key,
    staleTime: Infinity,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  })
  const label = walkLabel(data ?? null)
  if (!label) return <div className="leg" aria-hidden="true" />
  return <div className="leg"><Icon name="walk" size={16} /><span>{label}</span></div>
}
