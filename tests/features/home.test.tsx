import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { trip, stop, place } from '../factories'
import type { Trip, Stop } from '../../src/lib/types'

const db = vi.hoisted(() => ({
  tripsQ: null as null | Record<string, unknown>,
  trips: [] as unknown[],
  stops: [] as unknown[],
  links: [] as unknown[],
  members: [] as unknown[],
  globe: null as null | { pins: { code: string }[] },
  save: vi.fn((r: unknown) => Promise.resolve(r)),
  remove: vi.fn(() => Promise.resolve()),
}))
vi.mock('../../src/lib/queries', () => ({
  useTrips: () => db.tripsQ ?? ({ data: db.trips, isLoading: false }),
  useStops: () => ({ data: db.stops, isLoading: false }),
  useLinks: () => ({ data: db.links }),
  useMembers: () => ({ data: db.members }),
  useRates: () => ({ data: null }),
  useSave: () => ({ mutateAsync: db.save, isPending: false }),
  useRemove: () => ({ mutateAsync: db.remove, isPending: false }),
}))
const env = vi.hoisted(() => ({ online: true, signOut: vi.fn(), forget: vi.fn() }))
vi.mock('../../src/lib/offline', () => ({ useCanEdit: () => true, useOnline: () => env.online, forgetDevice: env.forget }))
vi.mock('../../src/lib/auth', () => ({ useAuth: () => ({ status: 'signed-in', email: 'shanice@x.com', userId: 'u1', signOut: env.signOut }) }))
vi.mock('../../src/features/home/Globe', () => ({
  Globe: (p: { onCountry: (c: string) => void; pins: { code: string }[] }) => {
    db.globe = p
    return <button onClick={() => p.onCountry('FI')}>globe</button>
  },
}))

import { HomePage } from '../../src/features/home/HomePage'
import { TripForm } from '../../src/features/home/TripForm'

function show() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/trip/:id" element={<p>opened trip</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-05T10:00:00'))
  db.trips = []; db.stops = []; db.links = []; db.save.mockClear(); db.remove.mockClear()
  db.globe = null; env.online = true
  db.members = []; env.signOut.mockReset().mockResolvedValue(undefined); env.forget.mockReset().mockResolvedValue(undefined)
})
afterEach(() => vi.useRealTimers())

function europe() {
  const ex = trip({ id: 'ex', name: 'europe exchange 2027', start_date: '2027-01-28', end_date: '2027-07-13' })
  const lap = trip({ id: 'lap', parent_id: 'ex', name: 'lapland', start_date: '2027-02-07', end_date: '2027-02-11', color: 1 })
  const par = trip({ id: 'par', parent_id: 'ex', name: 'paris', start_date: '2027-03-05', end_date: '2027-03-08', color: 2 })
  const sum = trip({ id: 'sum', name: 'summer', start_date: '2027-06-01', end_date: '2027-06-10' })
  return [sum, lap, ex, par] as Trip[]
}

it('next up shows the soonest top-level trip first with its countdown', () => {
  db.trips = europe()
  show()
  expect(screen.getByRole('heading', { name: 'next up' })).toBeInTheDocument()
  const cards = screen.getAllByTestId('trip-card')
  expect(cards[0]).toHaveTextContent('europe exchange 2027')
  expect(within(cards[0]).getByText('84')).toBeInTheDocument()
  expect(cards[0]).toHaveTextContent('2 side trips')
  expect(cards[1]).toHaveTextContent('summer')
  const rows = screen.getAllByTestId('side-row')
  expect(rows.map((r) => r.textContent)).toEqual([expect.stringContaining('lapland'), expect.stringContaining('paris')])
})

it('there is exactly one add-trip control on home', () => {
  db.trips = europe()
  show()
  expect(screen.getAllByRole('button', { name: 'new trip' })).toHaveLength(1)
})

it('no trips shows only the empty title', () => {
  show()
  expect(screen.getByText('no trips yet')).toBeVisible()
  expect(screen.queryByTestId('trip-card')).toBeNull()
  expect(screen.queryByRole('heading', { name: 'past trips' })).toBeNull()
  expect(screen.queryByText('life well lived')).toBeNull()
})

it('past appears once a top-level trip has ended', () => {
  db.trips = [trip({ name: 'bali', start_date: '2025-06-01', end_date: '2025-06-09' })]
  show()
  expect(screen.getByRole('heading', { name: 'past trips' })).toBeInTheDocument()
  expect(screen.getByText('bali')).toBeInTheDocument()
})

it('totals count countries, cities and trips', () => {
  db.trips = europe()
  db.stops = [
    stop({ trip_id: 'lap', place: place({ name: 'arktikum', city: 'rovaniemi', country: 'FI' }) }),
    stop({ trip_id: 'par', place: place({ name: 'louvre', city: 'paris', country: 'FR' }) }),
  ] as Stop[]
  show()
  const totals = screen.getByTestId('totals')
  expect(totals).toHaveTextContent(/2\s*countries/)
  expect(totals).toHaveTextContent(/2\s*cities/)
  expect(totals).toHaveTextContent(/4\s*trips/)
})

it('the numbers sit under "life well lived"', () => {
  db.trips = europe()
  show()
  const title = screen.getByText('life well lived')
  const totals = screen.getByTestId('totals')
  expect(title.compareDocumentPosition(totals) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(totals).toHaveAttribute('aria-labelledby', title.id)
})

it('trip form saves dates and currency', async () => {
  show()
  await userEvent.click(screen.getByRole('button', { name: 'new trip' }))
  const dialog = screen.getByRole('dialog', { name: 'new trip' })
  await userEvent.type(within(dialog).getByLabelText('name'), 'lapland')
  fireEvent.change(within(dialog).getByLabelText('starts'), { target: { value: '2027-02-07' } })
  fireEvent.change(within(dialog).getByLabelText('ends'), { target: { value: '2027-02-11' } })
  await userEvent.selectOptions(within(dialog).getByLabelText('currency'), 'SGD')
  await userEvent.click(within(dialog).getByRole('button', { name: 'save' }))
  expect(db.save).toHaveBeenCalledWith(expect.objectContaining({
    name: 'lapland', start_date: '2027-02-07', end_date: '2027-02-11', currency: 'SGD', parent_id: null,
  }))
})

it('trip form refuses an end before the start', async () => {
  show()
  await userEvent.click(screen.getByRole('button', { name: 'new trip' }))
  const dialog = screen.getByRole('dialog', { name: 'new trip' })
  await userEvent.type(within(dialog).getByLabelText('name'), 'x')
  fireEvent.change(within(dialog).getByLabelText('starts'), { target: { value: '2027-02-11' } })
  fireEvent.change(within(dialog).getByLabelText('ends'), { target: { value: '2027-02-07' } })
  await userEvent.click(within(dialog).getByRole('button', { name: 'save' }))
  expect(db.save).not.toHaveBeenCalled()
  expect(within(dialog).getByText('ends before it starts')).toBeInTheDocument()
})

it('delete is blocked while side trips exist', () => {
  db.trips = europe()
  render(<MemoryRouter><TripForm trip={db.trips[2] as Trip} onDone={() => {}} /></MemoryRouter>)
  expect(screen.getByText('move or delete its side trips first')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'delete trip' })).toBeDisabled()
})

it('part of excludes the trip itself and its side trips', () => {
  db.trips = europe()
  render(<MemoryRouter><TripForm trip={db.trips[2] as Trip} onDone={() => {}} /></MemoryRouter>)
  const opts = within(screen.getByLabelText('part of')).getAllByRole('option').map((o) => o.textContent)
  expect(opts).toEqual(['none', 'summer'])
})

it('choosing a country with two trips opens a chooser', async () => {
  db.trips = europe()
  db.stops = [
    stop({ trip_id: 'lap', place: place({ country: 'FI' }) }),
    stop({ trip_id: 'sum', place: place({ country: 'FI' }) }),
  ] as Stop[]
  show()
  await userEvent.click(await screen.findByRole('button', { name: 'globe' }))
  const sheet = screen.getByRole('dialog', { name: /finland/i })
  expect(within(sheet).getByText('lapland')).toBeInTheDocument()
  expect(within(sheet).getByText('summer')).toBeInTheDocument()
})

it('choosing a country with one trip opens it', async () => {
  db.trips = europe()
  db.stops = [stop({ trip_id: 'lap', place: place({ country: 'FI' }) })] as Stop[]
  show()
  await userEvent.click(await screen.findByRole('button', { name: 'globe' }))
  expect(screen.getByText('opened trip')).toBeInTheDocument()
})

it('home has only the next up and past trips headings', () => {
  db.trips = [trip({ name: 'bali', start_date: '2025-06-01', end_date: '2025-06-09' }), ...europe()]
  db.links = [{ id: 'l1', trip_id: null, url: 'https://www.instagram.com/reel/Cx1/', title: 'cafe reel', note: '' }]
  show()
  expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['next up', 'past trips'])
  expect(screen.queryByText('cafe reel')).toBeNull()
})

it('when every trip is over, next up says so', () => {
  db.trips = [trip({ name: 'bali', start_date: '2025-06-01', end_date: '2025-06-09' })]
  show()
  expect(screen.getByText('nothing coming up')).toBeInTheDocument()
})

it('the globe gets a pin for each country with a located place', async () => {
  db.trips = europe()
  db.stops = [stop({ trip_id: 'lap', place: place({ country: 'FI', lat: 66.5, lng: 25.7 }) })] as Stop[]
  show()
  await screen.findByRole('button', { name: 'globe' })
  expect(db.globe!.pins.map((p) => p.code)).toEqual(['FI'])
})

it('offline shows the inline pill in the header', () => {
  env.online = false
  show()
  const pill = screen.getByRole('status')
  expect(pill).toHaveTextContent('offline')
  expect(pill).not.toHaveClass('offline-badge')
})

it('account shows who is signed in, and signing out forgets this device', async () => {
  db.members = [{ email: 'Shanice@x.com', user_id: 'u1', name: 'Shanice', color: 0 }]
  show()
  await userEvent.click(screen.getByRole('button', { name: 'account' }))
  const sheet = screen.getByRole('dialog', { name: 'account' })
  expect(within(sheet).getByText('Shanice')).toBeInTheDocument()
  expect(within(sheet).getByText('shanice@x.com')).toBeInTheDocument()
  await userEvent.click(within(sheet).getByRole('button', { name: 'sign out' }))
  expect(env.signOut).toHaveBeenCalledTimes(1)
  await waitFor(() => expect(env.forget).toHaveBeenCalledWith(expect.any(QueryClient)))
})

it('sign out waits for a connection', async () => {
  env.online = false
  show()
  await userEvent.click(screen.getByRole('button', { name: 'account' }))
  expect(screen.getByRole('button', { name: 'sign out' })).toBeDisabled()
})

it('a failed sign out says so and keeps the data', async () => {
  env.signOut.mockRejectedValue(new Error('network'))
  show()
  await userEvent.click(screen.getByRole('button', { name: 'account' }))
  await userEvent.click(screen.getByRole('button', { name: 'sign out' }))
  expect(await screen.findByText("couldn't sign out")).toHaveClass('warn-line')
  expect(env.forget).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'sign out' })).toBeEnabled()
})

const loading = { data: undefined, status: 'pending', fetchStatus: 'fetching' }

beforeEach(() => { db.tripsQ = null })

it('home shows grey rows while trips load, never "no trips yet"', () => {
  db.tripsQ = loading
  show()
  expect(screen.getByRole('status', { name: 'loading' })).toBeInTheDocument()
  expect(screen.queryByText('no trips yet')).toBeNull()
})

it('home says when trips could not load, and retries', async () => {
  const refetch = vi.fn()
  db.tripsQ = { data: undefined, status: 'error', fetchStatus: 'idle', refetch }
  show()
  expect(screen.getByRole('alert')).toHaveTextContent("couldn't load")
  expect(screen.queryByText('no trips yet')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'retry' }))
  expect(refetch).toHaveBeenCalled()
})
