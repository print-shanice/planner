import { render, screen, act, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { trip } from '../factories'

const env = vi.hoisted(() => ({ canEdit: true }))
vi.mock('../../src/lib/offline', () => ({ useCanEdit: () => env.canEdit, useOnline: () => env.canEdit }))
vi.mock('../../src/lib/queries', async (orig) => ({
  ...(await orig<typeof import('../../src/lib/queries')>()),
  useTrips: () => ({ data: [] }), useLinks: () => ({ data: [] }), useStops: () => ({ data: [] }),
  useMembers: () => ({ data: [] }), useRates: () => ({ data: null }),
  useSave: () => ({ mutateAsync: vi.fn(), mutate: vi.fn() }), useRemove: () => ({ mutateAsync: vi.fn(), mutate: vi.fn() }),
}))
vi.mock('../../src/lib/supabase', () => ({ supabase: {} }))

import { safeUrl } from '../../src/lib/embed'
import { LinkCard } from '../../src/features/saved/LinkCard'
import { CostForm } from '../../src/features/money/CostForm'
import { AsleepBanner } from '../../src/lib/asleep'

it('only web links become links', () => {
  expect(safeUrl('https://a.com/x')).toBe('https://a.com/x')
  expect(safeUrl('javascript:alert(1)')).toBeNull()
  expect(safeUrl(' JavaScript:alert(1)')).toBeNull()
  expect(safeUrl('data:text/html,hi')).toBeNull()
})

it('a link card never renders a script url', () => {
  render(<MemoryRouter><LinkCard link={{ id: 'l', trip_id: 't', url: 'javascript:alert(1)', title: 'x', note: '' }} trips={[]} /></MemoryRouter>)
  for (const a of document.querySelectorAll('a')) expect(a.getAttribute('href') ?? '').not.toMatch(/^javascript:/i)
})

it('the cost form cannot save offline', () => {
  env.canEdit = false
  render(<CostForm trip={trip()} onDone={() => {}} />)
  expect(screen.getByRole('button', { name: 'save' })).toBeDisabled()
  env.canEdit = true
})

it('a server that does not answer while online shows the asleep banner, and it clears on success', async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  let fail = true
  function Probe() {
    useQuery({ queryKey: ['trips'], queryFn: () => (fail ? Promise.reject(Object.assign(new Error('TypeError: Failed to fetch'), { status: 0 })) : Promise.resolve([])) })
    return null
  }
  render(<QueryClientProvider client={qc}><MemoryRouter><AsleepBanner /><Probe /></MemoryRouter></QueryClientProvider>)
  expect(await screen.findByText('the planner is asleep')).toHaveClass('warn-line')
  expect(screen.getByRole('link', { name: 'open supabase' })).toHaveAttribute('href', 'https://supabase.com/dashboard')
  fail = false
  await act(async () => { await qc.refetchQueries({ queryKey: ['trips'] }) })
  await waitFor(() => expect(screen.queryByText('the planner is asleep')).toBeNull())
})

it('a refused request is not mistaken for sleep', async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Probe() {
    useQuery({ queryKey: ['stops'], queryFn: () => Promise.reject(Object.assign(new Error('denied'), { status: 401 })) })
    return null
  }
  render(<QueryClientProvider client={qc}><MemoryRouter><AsleepBanner /><Probe /></MemoryRouter></QueryClientProvider>)
  await new Promise((r) => setTimeout(r, 50))
  expect(screen.queryByText('the planner is asleep')).toBeNull()
})
