import { act, fireEvent, render, screen } from '@testing-library/react'
import { ToastProvider, useToast } from '../../src/components/Toast'

let api: ReturnType<typeof useToast>
function Grab() { api = useToast(); return null }
const mount = () => render(<ToastProvider><Grab /></ToastProvider>)

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

it('undo runs the undo, not the finish', () => {
  mount()
  const undo = vi.fn(), done = vi.fn()
  act(() => api.show({ text: 'removed', undo, done }))
  expect(screen.getByRole('status')).toHaveTextContent('removed')
  fireEvent.click(screen.getByRole('button', { name: 'undo' }))
  expect(undo).toHaveBeenCalled()
  expect(done).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'undo' })).toBeNull()
})

it('after five seconds it finishes and goes', () => {
  mount()
  const done = vi.fn()
  act(() => api.show({ text: 'removed', undo: vi.fn(), done }))
  act(() => { vi.advanceTimersByTime(4999) })
  expect(done).not.toHaveBeenCalled()
  act(() => { vi.advanceTimersByTime(1) })
  expect(done).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
})

it('a new toast finishes the old one', () => {
  mount()
  const first = vi.fn()
  act(() => api.show({ text: 'removed', undo: vi.fn(), done: first }))
  act(() => api.show({ text: 'removed', undo: vi.fn(), done: vi.fn() }))
  expect(first).toHaveBeenCalledTimes(1)
})

it('it waits while the undo button has focus', () => {
  mount()
  const done = vi.fn()
  act(() => api.show({ text: 'removed', undo: vi.fn(), done }))
  act(() => screen.getByRole('button', { name: 'undo' }).focus())
  act(() => { vi.advanceTimersByTime(10_000) })
  expect(done).not.toHaveBeenCalled()
  act(() => screen.getByRole('button', { name: 'undo' }).blur())
  act(() => { vi.advanceTimersByTime(5000) })
  expect(done).toHaveBeenCalled()
})

it('leaving the page finishes what is waiting', () => {
  mount()
  const done = vi.fn()
  act(() => api.show({ text: 'removed', undo: vi.fn(), done }))
  act(() => { window.dispatchEvent(new Event('pagehide')) })
  expect(done).toHaveBeenCalledTimes(1)
})

it('with no toast area, it finishes at once', () => {
  render(<Grab />)
  const done = vi.fn()
  api.show({ text: 'removed', done })
  expect(done).toHaveBeenCalled()
})
