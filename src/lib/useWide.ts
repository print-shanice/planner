import { useSyncExternalStore } from 'react'

const Q = '(min-width: 1024px)'
const mq = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(Q) : null)

export function useWide(): boolean {
  return useSyncExternalStore(
    (cb) => { const m = mq(); m?.addEventListener('change', cb); return () => m?.removeEventListener('change', cb) },
    () => mq()?.matches ?? false,
    () => false,
  )
}
