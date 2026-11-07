import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

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
