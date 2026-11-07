import { useQuery } from '@tanstack/react-query'
import type { Place } from '../../lib/types'
import { walkKey, walkLabel, walkSeconds } from '../../lib/walk'
import { Icon } from '../../components/Icon'

export function WalkLeg({ from, to }: { from: Place; to: Place }) {
  const key = walkKey(from, to)
  const { data, isPending } = useQuery({
    queryKey: ['walk', key],
    queryFn: () => walkSeconds(from, to),
    enabled: !!key,
    staleTime: Infinity,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  })
  const label = walkLabel(data ?? null)
  // still working it out: the leg breathes quietly instead of sitting empty
  if (isPending && key) return <div className="leg pulse" aria-hidden="true"><Icon name="walk" size={16} /></div>
  if (!label) return <div className="leg" aria-hidden="true" />
  return <div className="leg"><Icon name="walk" size={16} /><span>{label}</span></div>
}
