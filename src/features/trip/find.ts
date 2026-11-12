import { useSearchParams } from 'react-router-dom'
import type { Stop } from '../../lib/types'
import { useWide } from '../../lib/useWide'

// "find on the map" for a line that has no place yet: ?find=<stop id>. a laptop's map is beside the plan already;
// a phone goes to its map tab, on that line's day
export function useStartFind(): (s: Stop) => void {
  const [, setParams] = useSearchParams()
  const wide = useWide()
  return (s: Stop) => setParams((p) => {
    const n = new URLSearchParams(p)
    n.set('find', s.id)
    if (!wide) {
      n.set('tab', 'map')
      if (s.day) n.set('day', s.day)
    }
    return n
  })
}
