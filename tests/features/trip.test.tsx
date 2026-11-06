import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { trip } from '../factories'
import type { Trip } from '../../src/lib/types'

const db = vi.hoisted(() => ({ trips: [] as unknown[], tripsQ: null as null | Record<string, unknown> }))
vi.mock('../../src/lib/queries', () => ({
  useTrips: () => db.tripsQ ?? ({ data: db.trips, isLoading: false }),
  useStops: () => ({ data: [] }),
  useCosts: () => ({ data: [] }),
  useLinks: () => ({ data: [] }),
  usePacking: () => ({ data: [] }),
  useFiles: () => ({ data: [] }),
  useMembers: () => ({ data: [{ email: 'shanice@x.com', user_id: 'u1', name: 'shanice', color: 0 }] }),
  useRates: () => ({ data: null }),
  useSave: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRemove: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('../../src/lib/offline', () => ({ useCanEdit: () => true, useOnline: () => true }))
vi.mock('../../src/features/map/MapTab', () => ({ MapTab: () => <p>map here</p> }))

import { TripPage } from '../../src/features/trip/TripPage'

function Probe() {
  const l = useLocation()
  return <output data-testid="loc">{l.pathname + l.search}</output>
}

function show(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>home</p>} />
        <Route path="/trip/:id" element={<><TripPage /><Probe /></>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  db.trips = [
    trip({ id: 'eu2027', name: 'europe exchange 2027', start_date: '2027-01-28', end_date: '2027-07-13' }),
    trip({ id: 'summer', parent_id: 'eu2027', name: 'the long summer', start_date: '2027-06-26', end_date: '2027-07-13' }),
  ] as Trip[]
})

it('breadcrumb lists parent trips root first', () => {
  show('/trip/summer')
  const crumbs = screen.getByRole('navigation', { name: 'breadcrumb' })
  const links = within(crumbs).getAllByRole('link').map((a) => a.getAttribute('aria-label') ?? a.textContent)
  expect(links).toEqual(['all trips', 'europe exchange 2027'])
  expect(screen.getByRole('heading', { level: 1, name: 'the long summer' })).toBeInTheDocument()
  expect(screen.getByText('26 jun – 13 jul · 17 nights')).toBeInTheDocument()
})

function family() {
  db.trips = [
    ...(db.trips as Trip[]),
    trip({ id: 'lap', parent_id: 'eu2027', name: 'lapland', start_date: '2027-02-07', end_date: '2027-02-11', color: 1 }),
    trip({ id: 'rov', parent_id: 'lap', name: 'rovaniemi day', start_date: '2027-02-09', end_date: '2027-02-09', color: 2 }),
    trip({ id: 'some', parent_id: 'eu2027', name: 'someday rome', start_date: null, end_date: null }),
  ] as Trip[]
}

it('the title opens the whole trip family as a tree, and a row opens that trip', async () => {
  family()
  show('/trip/summer')
  await userEvent.click(screen.getByRole('button', { name: 'the long summer' }))
  const sheet = screen.getByRole('dialog', { name: 'trips' })
  const names = () => within(sheet).getAllByRole('link').map((a) => a.querySelector('.tree-name')?.textContent)
  // side trips in date order, undated last; deeper side trips stay folded away off the current path
  expect(names()).toEqual(['europe exchange 2027', 'lapland', 'the long summer', 'someday rome'])
  expect(within(sheet).getByRole('link', { name: /the long summer/ })).toHaveAttribute('aria-current', 'page')
  expect(within(sheet).getByRole('link', { name: /lapland/ })).toHaveTextContent('7 – 11 feb')
  expect(within(sheet).getByRole('link', { name: /someday rome/ })).toHaveTextContent('no dates')
  const toggle = within(sheet).getByRole('button', { name: 'side trips of lapland' })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await userEvent.click(toggle)
  expect(names()).toContain('rovaniemi day')
  await userEvent.click(within(sheet).getByRole('link', { name: /lapland/ }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/trip/lap')
  expect(screen.queryByRole('dialog', { name: 'trips' })).toBeNull()
  expect(screen.getByRole('heading', { level: 1, name: 'lapland' })).toBeInTheDocument()
})

it('a side trip deep down opens the tree along its path', async () => {
  family()
  show('/trip/rov')
  await userEvent.click(screen.getByRole('button', { name: 'rovaniemi day' }))
  const sheet = screen.getByRole('dialog', { name: 'trips' })
  expect(within(sheet).getByRole('button', { name: 'side trips of lapland' })).toHaveAttribute('aria-expanded', 'true')
  expect(within(sheet).getByRole('link', { name: /rovaniemi day/ })).toHaveAttribute('aria-current', 'page')
})

it('a trip on its own has a plain title', () => {
  db.trips = [trip({ id: 'solo', name: 'solo trip' })] as Trip[]
  show('/trip/solo')
  expect(screen.getByRole('heading', { level: 1, name: 'solo trip' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'solo trip' })).toBeNull()
})

it('add menu has exactly the six options', async () => {
  show('/trip/summer')
  await userEvent.click(screen.getByRole('button', { name: 'add' }))
  const menu = screen.getByRole('dialog', { name: 'add' })
  const names = within(menu).getAllByRole('button').map((b) => b.textContent).filter((t) => t)
  expect(names).toEqual(['stay', 'journey', 'note', 'cost', 'link', 'side trip'])
})

it('side trip opens the trip form for a child', async () => {
  show('/trip/summer')
  await userEvent.click(screen.getByRole('button', { name: 'add' }))
  await userEvent.click(screen.getByRole('button', { name: 'side trip' }))
  expect(screen.getByRole('dialog', { name: 'new side trip' })).toBeInTheDocument()
})

it('tab is kept in the url', async () => {
  show('/trip/summer')
  await userEvent.click(screen.getByRole('tab', { name: 'money' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/trip/summer?tab=money')
  expect(screen.getByRole('tab', { name: 'money' })).toHaveAttribute('aria-selected', 'true')
})

it('there is one add control and five tabs on a phone', () => {
  show('/trip/summer')
  expect(screen.getAllByRole('button', { name: 'add' })).toHaveLength(1)
  expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['plan', 'map', 'money', 'saved', 'packing'])
})

it('unknown trip shows not found', () => {
  show('/trip/nope')
  expect(screen.getByText('trip not found')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'all trips' })).toHaveAttribute('href', '/')
})

it('stay from the add menu opens a new stay with the trip dates', async () => {
  show('/trip/summer')
  await userEvent.click(screen.getByRole('button', { name: 'add' }))
  await userEvent.click(screen.getByRole('button', { name: 'stay' }))
  const d = await screen.findByRole('dialog', { name: 'new stay' })
  expect(within(d).getByLabelText('check-in')).toHaveValue('2027-06-26')
  expect(within(d).getByLabelText('check-out')).toHaveValue('2027-07-13')
})

it('cost and link from the add menu open their forms', async () => {
  show('/trip/summer')
  await userEvent.click(screen.getByRole('button', { name: 'add' }))
  await userEvent.click(screen.getByRole('button', { name: 'cost' }))
  expect(await screen.findByRole('dialog', { name: 'new cost' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'close' }))
  await userEvent.click(screen.getByRole('button', { name: 'add' }))
  await userEvent.click(screen.getByRole('button', { name: 'link' }))
  expect(await screen.findByRole('dialog', { name: 'new link' })).toBeInTheDocument()
})

const loading = { data: undefined, status: 'pending', fetchStatus: 'fetching' }

beforeEach(() => { db.tripsQ = null })

it('a trip that is still loading shows grey rows, not "trip not found"', () => {
  db.tripsQ = loading
  show('/trip/summer')
  expect(screen.getByRole('status', { name: 'loading' })).toBeInTheDocument()
  expect(screen.queryByText('trip not found')).toBeNull()
})

it('opening a trip offline with nothing saved says offline', () => {
  db.tripsQ = { data: undefined, status: 'pending', fetchStatus: 'paused' }
  show('/trip/summer')
  expect(screen.getByText('offline')).toBeInTheDocument()
  expect(screen.queryByText('trip not found')).toBeNull()
})

it('a trip that could not load offers retry and the way home', () => {
  db.tripsQ = { data: undefined, status: 'error', fetchStatus: 'idle', refetch: vi.fn() }
  show('/trip/summer')
  expect(screen.getByRole('alert')).toHaveTextContent("couldn't load")
  expect(screen.getByRole('link', { name: 'all trips' })).toBeInTheDocument()
  expect(screen.queryByText('trip not found')).toBeNull()
})
