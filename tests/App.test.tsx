import { render, screen } from '@testing-library/react'
import { App } from '../src/App'

it('renders the red lowercase wordmark inside the .app root', async () => {
  render(<App />)
  const mark = await screen.findByRole('heading', { name: 'planner' })
  expect(mark).toHaveClass('wordmark')
  expect(mark.closest('.app')).not.toBeNull()
})
