import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Help, Tooltip } from '../../src/components/Tooltip'
import { Sheet } from '../../src/components/Sheet'

afterEach(() => vi.useRealTimers())

it('describes the focused control without changing its name or action', async () => {
  const click = vi.fn()
  render(<Tooltip text="open trip settings"><button aria-describedby="existing" onClick={click}>travellers</button></Tooltip>)
  await userEvent.tab()
  const tip = screen.getByRole('tooltip')
  const button = screen.getByRole('button', { name: 'travellers' })
  expect(button).toHaveAttribute('aria-describedby', `existing ${tip.id}`)
  await userEvent.keyboard('{Enter}')
  expect(click).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('tooltip')).toBeNull()
})

it('waits for hover and stays readable when the pointer moves into the tooltip', () => {
  vi.useFakeTimers()
  render(<Tooltip text="drag to resize"><button>divider</button></Tooltip>)
  const button = screen.getByRole('button')
  fireEvent.pointerEnter(button, { pointerType: 'mouse' })
  expect(screen.queryByRole('tooltip')).toBeNull()
  act(() => vi.advanceTimersByTime(400))
  const tip = screen.getByRole('tooltip')
  fireEvent.pointerLeave(button)
  fireEvent.pointerEnter(tip)
  act(() => vi.advanceTimersByTime(200))
  expect(tip).toBeInTheDocument()
  fireEvent.pointerLeave(tip)
  act(() => vi.advanceTimersByTime(200))
  expect(screen.queryByRole('tooltip')).toBeNull()
  vi.useRealTimers()
})

it('Escape dismisses help before the enclosing sheet, retaining focus', async () => {
  const close = vi.fn()
  render(<Sheet open title="cost" onClose={close}><Help label="about splitting">split equally</Help></Sheet>)
  const button = screen.getByRole('button', { name: 'about splitting' })
  await userEvent.click(button)
  expect(screen.getByRole('tooltip')).toHaveTextContent('split equally')
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('tooltip')).toBeNull()
  expect(close).not.toHaveBeenCalled()
  expect(button).toHaveFocus()
  await userEvent.keyboard('{Escape}')
  expect(close).toHaveBeenCalledTimes(1)
})

it('touch can open explanatory help and outside interaction dismisses it', () => {
  render(<><Help label="about total">paid plus planned</Help><button>elsewhere</button></>)
  const button = screen.getByRole('button', { name: 'about total' })
  fireEvent.pointerDown(button, { pointerType: 'touch' })
  fireEvent.click(button)
  expect(screen.getByRole('tooltip')).toHaveTextContent('paid plus planned')
  fireEvent.pointerDown(screen.getByRole('button', { name: 'elsewhere' }))
  expect(screen.queryByRole('tooltip')).toBeNull()
})

it('shows only one tooltip and dismisses it when the page scrolls', async () => {
  render(<><Help label="first help">first</Help><Help label="second help">second</Help></>)
  await userEvent.click(screen.getByRole('button', { name: 'first help' }))
  await userEvent.click(screen.getByRole('button', { name: 'second help' }))
  expect(screen.getAllByRole('tooltip')).toHaveLength(1)
  expect(screen.getByRole('tooltip')).toHaveTextContent('second')
  fireEvent.scroll(window)
  expect(screen.queryByRole('tooltip')).toBeNull()
})

it('can leave a reopened tooltip after dismissing while hovering its text', () => {
  vi.useFakeTimers()
  render(<Tooltip text="help"><button>action</button></Tooltip>)
  const button = screen.getByRole('button')
  fireEvent.pointerEnter(button)
  act(() => vi.advanceTimersByTime(400))
  fireEvent.pointerLeave(button)
  fireEvent.pointerEnter(screen.getByRole('tooltip'))
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('tooltip')).toBeNull()
  fireEvent.pointerEnter(button)
  act(() => vi.advanceTimersByTime(400))
  expect(screen.getByRole('tooltip')).toBeInTheDocument()
  fireEvent.pointerLeave(button)
  act(() => vi.advanceTimersByTime(200))
  expect(screen.queryByRole('tooltip')).toBeNull()
})

it('keyboard focus still reveals help after a drag that prevented pointer focus', () => {
  render(<Tooltip text="drag or use arrow keys"><button onPointerDown={e => e.preventDefault()}>handle</button></Tooltip>)
  const button = screen.getByRole('button')
  fireEvent.pointerDown(button)
  fireEvent.pointerUp(document.body)
  fireEvent.focus(button)
  expect(screen.getByRole('tooltip')).toHaveTextContent('drag or use arrow keys')
})

it('Escape closes help even when an editor prevents default, preserving its handler', () => {
  vi.useFakeTimers()
  const edited = vi.fn()
  render(<Tooltip text="automatically ordered"><input aria-label="time" onKeyDown={e => {
    if (e.key === 'Escape') { e.preventDefault(); edited(); e.currentTarget.blur() }
  }} /></Tooltip>)
  const input = screen.getByRole('textbox')
  fireEvent.pointerEnter(input)
  act(() => vi.advanceTimersByTime(400))
  fireEvent.keyDown(input, { key: 'Escape' })
  expect(edited).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('tooltip')).toBeNull()
})
