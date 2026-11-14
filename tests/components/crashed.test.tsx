import { render, screen } from '@testing-library/react'
import { Crashed } from '../../src/components/Crashed'

function Broken(): never { throw new Error('cannot read properties of undefined (reading "lat")') }

it('a screen that breaks shows what broke and a way back, never a blank page', () => {
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
  render(<Crashed><Broken /></Crashed>)
  expect(screen.getByRole('alert')).toHaveTextContent('something on this page broke')
  expect(screen.getByText(/reading "lat"/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'try again' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'reload from the server' })).toBeInTheDocument()
  quiet.mockRestore()
})

it('the live site keeps what broke to the console', () => {
  vi.stubEnv('DEV', false)
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
  render(<Crashed><Broken /></Crashed>)
  expect(screen.getByRole('alert')).toHaveTextContent('something on this page broke')
  expect(screen.queryByText(/reading "lat"/)).toBeNull()
  expect(quiet).toHaveBeenCalledWith('planner crashed', expect.any(Error), expect.anything())
  quiet.mockRestore()
  vi.unstubAllEnvs()
})
