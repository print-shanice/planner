import { useQuery } from '@tanstack/react-query'
import type { Located } from '../../lib/legs'
import { directionsUrl } from '../../lib/gmaps'
import { walkKey, walkLabel, walkSeconds } from '../../lib/walk'
import { Icon } from '../../components/Icon'

export function WalkLeg({ from, to }: { from: Located; to: Located }) {
  const key = walkKey(from, to)
  const { data, isPending } = useQuery({
    queryKey: ['walk', key],
    queryFn: () => walkSeconds(from, to),
    enabled: !!key,
    staleTime: Infinity,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  })
  const label = walkLabel(data ?? null)
  const waiting = isPending && !!key
  const text = !waiting && label ? label : 'directions'
  // every leg is a link out; the walk time is its name once known
  return (
    <a className={`leg${waiting ? ' pulse' : ''}`} href={directionsUrl(from, to)} target="_blank" rel="noopener noreferrer">
      <Icon name="walk" size={16} />
      <span>{text}</span>
      <Icon name="next" size={14} />
    </a>
  )
}
