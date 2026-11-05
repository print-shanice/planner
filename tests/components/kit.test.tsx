import { render, screen, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'

vi.mock('../../src/lib/supabase', () => ({ supabase: {} }))

import { Pill } from '../../src/components/Pill'
import { Sheet } from '../../src/components/Sheet'
import { TwoTapDelete } from '../../src/components/TwoTapDelete'
import { OfflineBadge } from '../../src/components/OfflineBadge'
import { EmptyState } from '../../src/components/EmptyState'
import { Icon } from '../../src/components/Icon'

it('pill colours follow the colour rules', () => {
  expect(render(<Pill status="idea" />).container).toBeEmptyDOMElement()
  expect(render(<Pill status="estimate" />).container).toBeEmptyDOMElement()
  render(<Pill status="to_book" />)
  expect(screen.getByText('to book')).toHaveClass('pill', 'warn')
  render(<Pill status="booked" />)
  expect(screen.getByText('booked')).toHaveClass('pill', 'ok')
  render(<Pill status="paid" />)
  expect(screen.getByText('paid')).toHaveClass('pill', 'ok')
  render(<Pill status="warn" label="clash" />)
  expect(screen.getByText('clash')).toHaveClass('pill', 'warn')
})

it('sheet closes on escape and keeps children mounted while open', async () => {
  const onClose = vi.fn()
  function Host({ n }: { n: number }) {
    const [v, setV] = useState('')
    return (
      <Sheet open title={`edit ${n}`} onClose={onClose}>
        <input aria-label="name" value={v} onChange={(e) => setV(e.target.value)} />
      </Sheet>
    )
  }
  const { rerender } = render(<Host n={1} />)
  const dialog = screen.getByRole('dialog', { name: 'edit 1' })
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  expect(dialog.contains(document.activeElement)).toBe(true)
  await userEvent.type(screen.getByLabelText('name'), 'arktikum')
  rerender(<Host n={2} />)
  expect(screen.getByLabelText('name')).toHaveValue('arktikum')
  await userEvent.keyboard('{Escape}')
  expect(onClose).toHaveBeenCalledTimes(1)
})

it('sheet closes on a backdrop tap but not a tap inside', async () => {
  const onClose = vi.fn()
  render(<Sheet open title="t" onClose={onClose}><p>inside</p></Sheet>)
  await userEvent.click(screen.getByText('inside'))
  expect(onClose).not.toHaveBeenCalled()
  fireEvent.mouseDown(document.querySelector('.sheet-backdrop')!)
  fireEvent.click(document.querySelector('.sheet-backdrop')!)
  expect(onClose).toHaveBeenCalledTimes(1)
})

it('a closed sheet renders nothing', () => {
  render(<Sheet open={false} title="t" onClose={() => {}}><p>x</p></Sheet>)
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('two-tap delete needs two taps', async () => {
  const onConfirm = vi.fn()
  render(<TwoTapDelete onConfirm={onConfirm} />)
  await userEvent.click(screen.getByRole('button', { name: 'delete' }))
  expect(onConfirm).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'tap again to delete' }))
  expect(onConfirm).toHaveBeenCalledTimes(1)
})

it('two-tap delete resets after 3 s', () => {
  vi.useFakeTimers()
  const onConfirm = vi.fn()
  render(<TwoTapDelete onConfirm={onConfirm} />)
  fireEvent.click(screen.getByRole('button', { name: 'delete' }))
  act(() => { vi.advanceTimersByTime(3100) })
  expect(screen.getByRole('button', { name: 'delete' })).toBeInTheDocument()
  vi.useRealTimers()
})

it('offline badge shows only offline', () => {
  const { container } = render(<OfflineBadge />)
  expect(container).toBeEmptyDOMElement()
  act(() => { window.dispatchEvent(new Event('offline')) })
  expect(screen.getByText('offline')).toBeInTheDocument()
  act(() => { window.dispatchEvent(new Event('online')) })
  expect(container).toBeEmptyDOMElement()
})

it('empty state is just its title', () => {
  const { container } = render(<EmptyState title="no trips yet" />)
  expect(container.textContent).toBe('no trips yet')
})

it('icons are hidden from screen readers', () => {
  const { container } = render(<Icon name="plus" />)
  expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
})
