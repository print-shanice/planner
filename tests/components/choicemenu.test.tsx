import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChoiceMenu } from '../../src/components/ChoiceMenu'

const options = [
  { value: 'eu', label: 'euro summer', color: 0 },
  { value: 'par', label: 'paris', color: 2, depth: 1 },
  { value: 'gr', label: 'greek islands', color: 4 },
]

function show(onPick = vi.fn(), disabled = false) {
  render(<><ChoiceMenu label="to a trip" ariaLabel="move cafe reel to a trip" options={options} onPick={onPick} disabled={disabled} /><button>elsewhere</button></>)
  return onPick
}

it('looks like a text link and opens its own list, not the browser\'s', async () => {
  show()
  const button = screen.getByRole('button', { name: 'move cafe reel to a trip' })
  expect(button).toHaveTextContent('to a trip')
  expect(button).toHaveAttribute('aria-haspopup', 'listbox')
  expect(button).toHaveAttribute('aria-expanded', 'false')
  expect(document.querySelector('select')).toBeNull()
  await userEvent.click(button)
  expect(button).toHaveAttribute('aria-expanded', 'true')
  const list = screen.getByRole('listbox', { name: 'move cafe reel to a trip' })
  expect(within(list).getAllByRole('option').map((o) => o.textContent)).toEqual(['euro summer', 'paris', 'greek islands'])
  expect(within(list).getByRole('option', { name: 'paris' })).toHaveAttribute('data-depth', '1')
})

it('a tap on an option picks it and closes', async () => {
  const onPick = show()
  await userEvent.click(screen.getByRole('button', { name: 'move cafe reel to a trip' }))
  await userEvent.click(screen.getByRole('option', { name: 'paris' }))
  expect(onPick).toHaveBeenCalledWith('par')
  expect(screen.queryByRole('listbox')).toBeNull()
})

it('works from the keyboard: arrows and end move, enter picks, escape closes', async () => {
  const onPick = show()
  screen.getByRole('button', { name: 'move cafe reel to a trip' }).focus()
  await userEvent.keyboard('{Enter}')
  expect(screen.getByRole('option', { name: 'euro summer' })).toHaveFocus()
  await userEvent.keyboard('{ArrowDown}{ArrowDown}')
  expect(screen.getByRole('option', { name: 'greek islands' })).toHaveFocus()
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('listbox')).toBeNull()
  expect(screen.getByRole('button', { name: 'move cafe reel to a trip' })).toHaveFocus()
  expect(onPick).not.toHaveBeenCalled()
  await userEvent.keyboard('{Enter}{End}{Enter}')
  expect(onPick).toHaveBeenCalledWith('gr')
})

it('a tap anywhere else closes it without picking', async () => {
  const onPick = show()
  await userEvent.click(screen.getByRole('button', { name: 'move cafe reel to a trip' }))
  await userEvent.click(screen.getByRole('button', { name: 'elsewhere' }))
  expect(screen.queryByRole('listbox')).toBeNull()
  expect(onPick).not.toHaveBeenCalled()
})

it('floats above the page, so opening it never moves or gets cut off by a list', async () => {
  show()
  await userEvent.click(screen.getByRole('button', { name: 'move cafe reel to a trip' }))
  const list = screen.getByRole('listbox')
  expect(list.parentElement).toBe(document.body)
  expect(list.style.position).toBe('fixed')
})

it('can be switched off', () => {
  show(vi.fn(), true)
  expect(screen.getByRole('button', { name: 'move cafe reel to a trip' })).toBeDisabled()
})

it('scrolling its own list of trips keeps it open; the page scrolling under it closes it', async () => {
  show()
  await userEvent.click(screen.getByRole('button', { name: 'move cafe reel to a trip' }))
  const list = screen.getByRole('listbox')
  fireEvent.scroll(list)
  expect(screen.getByRole('listbox')).toBeInTheDocument()
  fireEvent.scroll(window)
  expect(screen.queryByRole('listbox')).toBeNull()
})
