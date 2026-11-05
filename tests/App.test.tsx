import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from '../src/App'

it('renders the red lowercase wordmark inside the .app root', async () => {
  render(<QueryClientProvider client={new QueryClient()}><App /></QueryClientProvider>)
  const mark = await screen.findByRole('heading', { name: 'planner' })
  expect(mark).toHaveClass('wordmark')
  expect(mark.closest('.app')).not.toBeNull()
})
