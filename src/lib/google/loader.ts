import { useSyncExternalStore } from 'react'
import { googleKey } from './config'

// 'auth': google refused the key (wrong key, this address not allowed, or billing off)
export type GoogleState = 'idle' | 'loading' | 'ready' | 'failed' | 'auth' | 'none'

let state: GoogleState = 'idle'
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()
function set(s: GoogleState) { state = s; for (const l of listeners) l() }

export function googleState(): GoogleState { return googleKey() ? state : 'none' }

export function useGoogleState(): GoogleState {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb) }, googleState, googleState)
}

// loaded once per visit, only when a map or a search first needs it
export function loadGoogle(): Promise<void> {
  const key = googleKey()
  if (!key) return Promise.reject(new Error('no google key'))
  if (typeof window !== 'undefined' && typeof (window as { google?: { maps?: { importLibrary?: unknown } } }).google?.maps?.importLibrary === 'function') { if (state !== 'auth') set('ready'); return Promise.resolve() }
  if (loading) return loading
  set('loading')
  loading = new Promise<void>((resolve, reject) => {
    const w = window as unknown as Record<string, unknown>
    w.__plannerGoogle = () => { set('ready'); resolve() }
    // google calls this when the key is refused; the map shows the setup note instead of a grey box
    w.gm_authFailure = () => set('auth')
    const s = document.createElement('script')
    const q = new URLSearchParams({ key, v: 'weekly', loading: 'async', callback: '__plannerGoogle', language: 'en' })
    s.src = `https://maps.googleapis.com/maps/api/js?${q}`
    s.async = true
    s.onerror = () => { loading = null; set('failed'); reject(new Error('google maps did not load')) }
    document.head.append(s)
  })
  return loading
}

export async function lib<T>(name: string): Promise<T> {
  await loadGoogle()
  return (await google.maps.importLibrary(name)) as T
}
