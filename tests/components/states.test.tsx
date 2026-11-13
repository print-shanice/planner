import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoadState } from '../../src/components/States'
import type { Load } from '../../src/lib/load'

const load = (o: Partial<Load>): Load => ({ state: 'ready', stale: false, retry: vi.fn(), ...o })

it('loading shows totoro and no empty title', () => {
  render(<LoadState load={load({ state: 'loading' })} />)
  const s = screen.getByRole('status', { name: 'loading' })
  expect(s.querySelector('img')).toHaveAttribute('src', expect.stringMatching(/loading\.gif$/))
  expect(s).not.toHaveTextContent(/\w/)
})

it('offline says so in one word', () => {
  render(<LoadState load={load({ state: 'offline' })} />)
  expect(screen.getByText('offline')).toHaveClass('empty')
})

it('failed says it could not load and retries', async () => {
  const l = load({ state: 'failed' })
  render(<LoadState load={l} />)
  expect(screen.getByRole('alert')).toHaveTextContent("couldn't load")
  await userEvent.click(screen.getByRole('button', { name: 'retry' }))
  expect(l.retry).toHaveBeenCalled()
})

it('ready shows nothing, or the notice when the refresh failed', () => {
  const { container, rerender } = render(<LoadState load={load({})} />)
  expect(container).toBeEmptyDOMElement()
  rerender(<LoadState load={load({ stale: true })} />)
  expect(screen.getByRole('alert')).toHaveTextContent("couldn't load")
})
