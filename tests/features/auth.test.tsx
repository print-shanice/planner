import { render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, AuthGate, useAuth } from '../../src/lib/auth'
import { pausePersist, persistPaused } from '../../src/lib/wipe'

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  signOut: vi.fn(),
}))
const rpc = vi.hoisted(() => vi.fn(() => Promise.resolve({ data: null, error: null })))
vi.mock('../../src/lib/supabase', () => ({ supabase: { auth, rpc } }))

const session = { user: { id: 'u1', email: 'shanice@x.com' } }
const ui = () => render(<AuthProvider><AuthGate><p>inside</p></AuthGate></AuthProvider>)

beforeEach(() => { vi.clearAllMocks() })

it('signed out shows only the email form', async () => {
  auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
  ui()
  expect(await screen.findByRole('button', { name: 'send link' })).toBeVisible()
  expect(screen.queryByText('inside')).toBeNull()
})

it('sending a link calls signInWithOtp with the redirect and no sign-up', async () => {
  auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
  auth.signInWithOtp.mockResolvedValue({ error: null })
  ui()
  await userEvent.type(await screen.findByLabelText('email'), 'a@b.co')
  await userEvent.click(screen.getByRole('button', { name: 'send link' }))
  expect(auth.signInWithOtp).toHaveBeenCalledWith({
    email: 'a@b.co',
    options: { emailRedirectTo: expect.stringContaining('/planner/'), shouldCreateUser: false },
  })
  expect(await screen.findByText('check your inbox')).toBeVisible()
  expect(screen.getByText('a@b.co')).toBeVisible()
})

it('an email that is not invited gets a short refusal', async () => {
  auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
  auth.signInWithOtp.mockResolvedValue({ error: { message: 'Signups not allowed for otp' } })
  ui()
  await userEvent.type(await screen.findByLabelText('email'), 'a@b.co')
  await userEvent.click(screen.getByRole('button', { name: 'send link' }))
  expect(await screen.findByText("this email isn't on the planner")).toBeVisible()
})

it('signed in renders children and claims membership once', async () => {
  auth.getSession.mockResolvedValue({ data: { session }, error: null })
  ui()
  expect(await screen.findByText('inside')).toBeVisible()
  await waitFor(() => expect(rpc).toHaveBeenCalledWith('claim_member'))
  expect(rpc).toHaveBeenCalledTimes(1)
})

it('network failure while online shows the asleep card', async () => {
  auth.getSession.mockRejectedValue(new TypeError('Failed to fetch'))
  ui()
  expect(await screen.findByText('the planner is asleep')).toBeVisible()
  expect(screen.getByRole('link', { name: 'open supabase' })).toHaveAttribute('href', 'https://supabase.com/dashboard')
})

it('the code from the email also signs in (for the home-screen app on iphone)', async () => {
  auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
  auth.signInWithOtp.mockResolvedValue({ error: null })
  auth.verifyOtp.mockResolvedValue({ data: { session }, error: null })
  ui()
  await userEvent.type(await screen.findByLabelText('email'), 'a@b.co')
  await userEvent.click(screen.getByRole('button', { name: 'send link' }))
  await userEvent.type(await screen.findByLabelText('code'), ' 123 456 ')
  await userEvent.click(screen.getByRole('button', { name: 'sign in' }))
  expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'a@b.co', token: '123456', type: 'email' })
})

it('a wrong code says so', async () => {
  auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
  auth.signInWithOtp.mockResolvedValue({ error: null })
  auth.verifyOtp.mockResolvedValue({ data: { session: null }, error: { message: 'Token has expired or is invalid' } })
  ui()
  await userEvent.type(await screen.findByLabelText('email'), 'a@b.co')
  await userEvent.click(screen.getByRole('button', { name: 'send link' }))
  await userEvent.type(await screen.findByLabelText('code'), '000000')
  await userEvent.click(screen.getByRole('button', { name: 'sign in' }))
  expect(await screen.findByText('that code didn\'t work')).toHaveClass('warn-line')
})

function SignOutButton() {
  const { signOut } = useAuth()
  const [result, setResult] = useState('sign out')
  return <button onClick={() => signOut().then(() => setResult('out'), () => setResult('failed'))}>{result}</button>
}

it('sign out says when it failed instead of pretending', async () => {
  auth.getSession.mockResolvedValue({ data: { session }, error: null })
  auth.signOut.mockResolvedValue({ error: { message: 'network' } })
  render(<AuthProvider><SignOutButton /></AuthProvider>)
  await userEvent.click(await screen.findByRole('button', { name: 'sign out' }))
  expect(await screen.findByRole('button', { name: 'failed' })).toBeInTheDocument()
})

it('sign out resolves when it worked', async () => {
  auth.getSession.mockResolvedValue({ data: { session }, error: null })
  auth.signOut.mockResolvedValue({ error: null })
  render(<AuthProvider><SignOutButton /></AuthProvider>)
  await userEvent.click(await screen.findByRole('button', { name: 'sign out' }))
  expect(await screen.findByRole('button', { name: 'out' })).toBeInTheDocument()
})

it('sign out only signs out this device', async () => {
  auth.getSession.mockResolvedValue({ data: { session }, error: null })
  auth.signOut.mockResolvedValue({ error: null })
  render(<AuthProvider><SignOutButton /></AuthProvider>)
  await userEvent.click(await screen.findByRole('button', { name: 'sign out' }))
  await screen.findByRole('button', { name: 'out' })
  expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
})

it('signing in lets the cache be saved again after a sign out', async () => {
  pausePersist()
  auth.getSession.mockResolvedValue({ data: { session }, error: null })
  ui()
  expect(await screen.findByText('inside')).toBeVisible()
  expect(persistPaused()).toBe(false)
})
