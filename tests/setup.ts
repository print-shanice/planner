import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// tests never use a real google key from .env.local: no requests, no cost, the same results on every machine
beforeEach(() => { vi.stubEnv('VITE_GOOGLE_MAPS_KEY', ''); vi.stubEnv('VITE_GOOGLE_MAP_ID', '') })

// the weather service is never asked for real: every test sees the same mild days, and nothing leaves the machine
const realFetch = globalThis.fetch?.bind(globalThis)
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.includes('open-meteo.com')) return Promise.resolve(new Response(JSON.stringify({ daily: { temperature_2m_max: [12, 14], temperature_2m_min: [4, 6] } }), { status: 200, headers: { 'content-type': 'application/json' } }))
  return realFetch ? realFetch(input, init) : Promise.reject(new Error('no network in tests'))
}) as typeof fetch

afterEach(() => {
  cleanup()
  localStorage.clear()
})

// jsdom has no object urls
URL.createObjectURL ??= (() => 'blob:test') as typeof URL.createObjectURL
URL.revokeObjectURL ??= (() => {}) as typeof URL.revokeObjectURL

// jsdom has no scrolling; the trip page restores each section's scroll position
window.scrollTo = (() => {}) as typeof window.scrollTo

// jsdom has no PointerEvent; a MouseEvent with a pointer id lets swipe tests carry clientX
if (!('PointerEvent' in window)) {
  class FakePointerEvent extends MouseEvent {
    pointerId: number
    pointerType: string
    constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 0; this.pointerType = init.pointerType ?? 'mouse' }
  }
  ;(window as unknown as { PointerEvent: unknown }).PointerEvent = FakePointerEvent
}
