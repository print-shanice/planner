import { act, renderHook, screen, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'

const db = vi.hoisted(() => ({ remove: vi.fn() }))
vi.mock('../../src/lib/queries', () => ({ useRemove: () => ({ mutateAsync: db.remove }) }))

import { ToastProvider } from '../../src/components/Toast'
import { useUndoRemove } from '../../src/lib/undo'
import { forgetPending, overlay, usePending } from '../../src/lib/pending'

const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>
const rows = [{ id: 'p1' }, { id: 'p2' }]

beforeEach(() => { vi.useFakeTimers(); db.remove.mockReset().mockResolvedValue(undefined) })
afterEach(() => { vi.useRealTimers(); forgetPending() })

function setup() {
  return renderHook(() => ({ remove: useUndoRemove('packing'), pending: usePending('packing') }), { wrapper })
}

it('removing hides the row at once and sends nothing yet', () => {
  const { result } = setup()
  act(() => result.current.remove('p1'))
  expect(overlay(rows, result.current.pending)).toEqual([{ id: 'p2' }])
  expect(db.remove).not.toHaveBeenCalled()
})

it('a hidden row stays hidden when the server still has it', () => {
  const { result } = setup()
  act(() => result.current.remove('p1'))
  // a realtime refetch hands back both rows again
  expect(overlay([{ id: 'p1' }, { id: 'p2' }], result.current.pending)).toEqual([{ id: 'p2' }])
})

it('undo brings it back without touching the server', () => {
  const { result } = setup()
  act(() => result.current.remove('p1'))
  fireEvent.click(screen.getByRole('button', { name: 'undo' }))
  expect(overlay(rows, result.current.pending)).toEqual(rows)
  act(() => { vi.advanceTimersByTime(6000) })
  expect(db.remove).not.toHaveBeenCalled()
})

it('when the toast goes, the delete is sent', async () => {
  const { result } = setup()
  act(() => result.current.remove('p1'))
  await act(async () => { vi.advanceTimersByTime(5000) })
  expect(db.remove).toHaveBeenCalledWith('p1')
})

it('a delete that fails puts the row back and says so', async () => {
  db.remove.mockRejectedValue(new Error('asleep'))
  const { result } = setup()
  act(() => result.current.remove('p1'))
  await act(async () => { vi.advanceTimersByTime(5000) })
  expect(overlay(rows, result.current.pending)).toEqual(rows)
  expect(screen.getByRole('status')).toHaveTextContent("couldn't remove")
})
