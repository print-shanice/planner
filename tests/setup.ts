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
