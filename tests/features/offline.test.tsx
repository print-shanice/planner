import { render, screen, act } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider, persistQueryClientSave } from '@tanstack/react-query-persist-client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { trip, stop, place } from '../factories'

vi.mock('../../src/lib/supabase', () => {
  const fail = () => Promise.reject(new TypeError('Failed to fetch'))
  const q: any = { select: fail, eq: () => q, insert: () => q, update: () => q, single: fail }
  return { supabase: { from: () => q, channel: () => ({ on() { return this }, subscribe() { return this } }), removeChannel: () => {}, storage: { from: () => ({ createSignedUrls: fail, download: fail }) } } }
})
vi.mock('../../src/lib/auth', () => ({ useAuth: () => ({ status: 'signed-in', userId: 'u1' }) }))
vi.mock('../../src/features/map/MapTab', () => ({ MapTab: () => null }))

import { persister } from '../../src/lib/offline'
import { keys } from '../../src/lib/queries'
import { TripPage } from '../../src/features/trip/TripPage'

it('offline: trip from the persisted cache renders and edit controls are disabled', async () => {
  const seed = new QueryClient()
  const t = trip({ id: 't1', name: 'lapland', start_date: '2027-02-07', end_date: '2027-02-09' })
  seed.setQueryData(keys.trips, [t])
  seed.setQueryData(keys.stops, [stop({ trip_id: 't1', title: 'arktikum', day: '2027-02-08', place: place() })])
  for (const k of ['costs', 'links', 'packing', 'files', 'members'] as const) seed.setQueryData(keys[k], [])
  await persistQueryClientSave({ queryClient: seed, persister })

  act(() => { window.dispatchEvent(new Event('offline')) })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, networkMode: 'offlineFirst', staleTime: 60_000 } } })
  render(
    <PersistQueryClientProvider client={client} persistOptions={{ persister }}>
      <MemoryRouter initialEntries={['/trip/t1?day=2027-02-08']}>
        <Routes><Route path="/trip/:id" element={<TripPage />} /></Routes>
      </MemoryRouter>
    </PersistQueryClientProvider>,
  )
  expect(await screen.findByRole('heading', { level: 2, name: 'monday 8 february' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'back to all trips' })).toBeInTheDocument()
  expect(screen.getByText('arktikum')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'add' })).toBeDisabled()
  expect(screen.queryByRole('group', { name: 'add to monday 8 february' })).toBeNull()
  expect(screen.getByText('offline')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'add a place' })).toBeNull()
  act(() => { window.dispatchEvent(new Event('online')) })
})
