import { useState } from 'react'
import type { Place } from '../../lib/types'
import type { Hit } from './usePlaceSearch'

// picking a result can take a moment (google fetches the place then); it says so, and says when it fails
export function usePick(resolve: (h: Hit) => Promise<Place>, done: (p: Place, h: Hit) => void) {
  const [picking, setPicking] = useState(false)
  const [failed, setFailed] = useState(false)
  async function pick(h: Hit) {
    setPicking(true); setFailed(false)
    try { done(await resolve(h), h) } catch { setFailed(true) } finally { setPicking(false) }
  }
  return { pick, picking, failed }
}
