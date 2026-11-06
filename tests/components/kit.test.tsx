import { render, screen, act, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'

vi.mock('../../src/lib/supabase', () => ({ supabase: {} }))

import { Pill } from '../../src/components/Pill'
import { Sheet, SheetFooter } from '../../src/components/Sheet'
import { TwoTapDelete } from '../../src/components/TwoTapDelete'
import { OfflineBadge } from '../../src/components/OfflineBadge'
import { EmptyState } from '../../src/components/EmptyState'
import { Icon } from '../../src/components/Icon'
import { Fold } from '../../src/components/Fold'

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

it('escape closes the newest sheet first, then the one under it', async () => {
  const closed: string[] = []
  function Host() {
    const [outer, setOuter] = useState(true)
    const [inner, setInner] = useState(false)
    return (
      <Sheet open={outer} title="stop" onClose={() => { closed.push('stop'); setOuter(false) }}>
        <button onClick={() => setInner(true)}>open ticket</button>
        <Sheet open={inner} title="ticket" onClose={() => { closed.push('ticket'); setInner(false) }}><p>pass</p></Sheet>
      </Sheet>
    )
  }
  render(<Host />)
  await userEvent.click(screen.getByRole('button', { name: 'open ticket' }))
  await userEvent.keyboard('{Escape}')
  expect(closed).toEqual(['ticket'])
  expect(screen.getByRole('dialog', { name: 'stop' })).toBeInTheDocument()
  await userEvent.keyboard('{Escape}')
  expect(closed).toEqual(['ticket', 'stop'])
})

it('a sheet footer sits outside the scrolling body', () => {
  render(<Sheet open title="new note" onClose={() => {}}><p>body</p><SheetFooter><button>save</button></SheetFooter></Sheet>)
  const save = screen.getByRole('button', { name: 'save' })
  expect(save.closest('.sheet-foot')).not.toBeNull()
  expect(save.closest('.sheet-body')).toBeNull()
})

it('a sheet footer without a sheet renders in place', () => {
  render(<div data-testid="here"><SheetFooter><button>save</button></SheetFooter></div>)
  expect(within(screen.getByTestId('here')).getByRole('button', { name: 'save' })).toBeInTheDocument()
})

it('the sheet rises above the on-screen keyboard', () => {
  const vv = Object.assign(new EventTarget(), { height: 800, offsetTop: 0 })
  Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
  render(<Sheet open title="new note" onClose={() => {}}><input /></Sheet>)
  vv.height = 500
  act(() => { vv.dispatchEvent(new Event('resize')) })
  expect(document.querySelector<HTMLElement>('.sheet-backdrop')!.style.getPropertyValue('--kb')).toBe('300px')
  Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true })
})

it('a fold starts closed and opens on tap', async () => {
  render(<Fold label="booking"><label>booking ref<input /></label></Fold>)
  const d = screen.getByText('booking').closest('details')!
  expect(d.open).toBe(false)
  await userEvent.click(screen.getByText('booking'))
  expect(d.open).toBe(true)
})

it('a fold opens by itself when it has something in it', () => {
  const { rerender } = render(<Fold label="cost" open={false}><input /></Fold>)
  const d = screen.getByText('cost').closest('details')!
  expect(d.open).toBe(false)
  rerender(<Fold label="cost" open><input /></Fold>)
  expect(d.open).toBe(true)
})
