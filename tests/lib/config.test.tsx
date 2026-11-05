import { render, screen } from '@testing-library/react'
import { configProblem, projectOrigin } from '../../src/lib/config'
import { ConfigProblem } from '../../src/features/auth/ConfigProblem'

const jwt = (payload: object) => `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify(payload)).replace(/=+$/, '')}.sig`

it('a correct url and publishable key pass', () => {
  expect(configProblem('https://abcd.supabase.co', 'sb_publishable_xyz')).toBeNull()
  expect(configProblem('https://abcd.supabase.co', jwt({ role: 'anon' }))).toBeNull()
})

it('a key in the url field is caught', () => {
  expect(configProblem('sb_publishable_xyz', 'sb_publishable_xyz')).toBe('url')
  expect(configProblem(undefined, 'sb_publishable_xyz')).toBe('url')
})

it('a secret key is refused before it is used', () => {
  expect(configProblem('https://abcd.supabase.co', 'sb_secret_abc')).toBe('secret')
  expect(configProblem('https://abcd.supabase.co', jwt({ role: 'service_role' }))).toBe('secret')
})

it('a missing key is caught', () => {
  expect(configProblem('https://abcd.supabase.co', '')).toBe('key')
})

it('the problem screen names the variable to fix', () => {
  render(<ConfigProblem problem="url" />)
  expect(screen.getByRole('heading', { name: 'planner' })).toBeInTheDocument()
  expect(screen.getByText('VITE_SUPABASE_URL')).toHaveClass('keep-case')
  expect(screen.getByText(/isn't the project url/)).toBeInTheDocument()
})

it('the api url with /rest/v1 still points at the project', () => {
  expect(projectOrigin('https://abcd.supabase.co/rest/v1/')).toBe('https://abcd.supabase.co')
  expect(projectOrigin(' https://abcd.supabase.co ')).toBe('https://abcd.supabase.co')
})
