import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { trip, stop, place } from '../factories'
import type { Trip } from '../../src/lib/types'

const db = vi.hoisted(() => ({ trips: [] as unknown[], stops: [] as unknown[], tripsQ: null as null | Record<string, unknown> }))
vi.mock('../../src/lib/queries', () => ({
  useTrips: () => db.tripsQ ?? ({ data: db.trips, isLoading: false }),
  useStops: () => ({ data: db.stops }),
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
  db.stops = []
  db.trips = [
    trip({ id: 'eu2027', name: 'europe exchange 2027', start_date: '2027-01-28', end_date: '2027-07-13' }),
    trip({ id: 'summer', parent_id: 'eu2027', name: 'the long summer', start_date: '2027-06-26', end_date: '2027-07-13' }),
  ] as Trip[]
})

it('a side trip says what it belongs to and its back arrow goes up to that trip', () => {
  show('/trip/summer')
  expect(screen.getByRole('link', { name: 'back to europe exchange 2027' })).toHaveAttribute('href', '/trip/eu2027')
  expect(screen.queryByText('side trip of europe exchange 2027')).toBeNull()
  expect(screen.getByRole('heading', { level: 1, name: 'the long summer' })).toBeInTheDocument()
  expect(screen.getByText('26 jun – 13 jul · 17 nights')).toBeInTheDocument()
})

it('a top trip goes back to all trips', () => {
  show('/trip/eu2027')
  expect(screen.getByRole('link', { name: 'back to all trips' })).toHaveAttribute('href', '/')
  expect(screen.queryByText(/side trip of/)).toBeNull()
})

it('keeps the full trip header when selecting itinerary dates', async () => {
  show('/trip/summer?tab=itinerary')
  expect(screen.getByRole('heading', { level: 1, name: 'the long summer' })).toBeVisible()
  await userEvent.click(screen.getByRole('button', { name: 'mon 28 jun' }))
  expect(screen.getByRole('heading', { level: 1, name: 'the long summer' })).toBeVisible()
  expect(screen.getByText('26 jun – 13 jul · 17 nights')).toBeVisible()
  expect(screen.getByRole('button', { name: 'edit trip' })).toBeVisible()
  expect(screen.getByRole('link', { name: 'back to europe exchange 2027' })).toHaveAttribute('href', '/trip/eu2027')
  expect(screen.getByTestId('day-2027-06-28')).toBeVisible()
  await userEvent.click(screen.getByRole('button', { name: 'calendar' }))
  expect(screen.getByTestId('calendar')).toBeVisible()
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

it('itinerary actions are named and there is no global add button', async () => {
  show('/trip/summer')
  expect(screen.queryByRole('button', { name: 'add' })).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'side trip' }))
  expect(screen.getByRole('dialog', { name: 'new side trip' })).toBeInTheDocument()
})

it('sections switch content while keeping the trip header', async () => {
  show('/trip/summer')
  await userEvent.click(screen.getByRole('button', { name: /cost/ }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/trip/summer?tab=cost')
  expect(screen.getByRole('heading', { level: 1, name: 'the long summer' })).toBeInTheDocument()
  expect(screen.getByTestId('calendar')).not.toBeVisible()
})

it('there is one add control and persistent section buttons', () => {
  show('/trip/summer')
  expect(screen.queryByRole('button', { name: 'add' })).toBeNull()
  expect(screen.queryByRole('tablist')).toBeNull()
  const sections = within(screen.getByRole('navigation', { name: 'trip sections' }))
  expect(sections.getAllByRole('button').map((b) => b.textContent)).toEqual(['calendar', 'itinerary', 'map', 'cost', 'ideas', 'links', 'packing'])
})

it('unknown trip shows not found', () => {
  show('/trip/nope')
  expect(screen.getByText('trip not found')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'all trips' })).toHaveAttribute('href', '/')
})

it('stay from the add menu opens a new stay with the trip dates', async () => {
  show('/trip/summer')
  await userEvent.click(screen.getByRole('button', { name: 'stay' }))
  const d = await screen.findByRole('dialog', { name: 'new stay' })
  expect(within(d).getByLabelText('check-in')).toHaveValue('2027-06-26')
  expect(within(d).getByLabelText('check-out')).toHaveValue('2027-07-13')
})

it('cost and links own their add forms', async () => {
  show('/trip/summer')
  await userEvent.click(screen.getByRole('button', { name: 'cost' }))
  await userEvent.click(screen.getByRole('button', { name: 'add cost' }))
  expect(await screen.findByRole('dialog', { name: 'new cost' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'close' }))
  await userEvent.click(screen.getByRole('button', { name: 'links' }))
  await userEvent.click(screen.getByRole('button', { name: 'add link' }))
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

for (const view of ['packing', 'map']) {
  it(`hides the general add button in ${view}`, () => {
    show(`/trip/summer?tab=${view}`)
    expect(screen.queryByRole('button', { name: 'add' })).toBeNull()
  })
}

it('switches directly between ideas and links without losing the trip header', async () => {
  show('/trip/summer?tab=ideas')
  expect(screen.getByRole('searchbox', { name: 'search ideas' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'links' }))
  expect(screen.getByTestId('calendar')).not.toBeVisible()
  expect(screen.getByRole('searchbox', { name: 'search links' })).toBeInTheDocument()
  expect(screen.queryByRole('searchbox', { name: 'search ideas' })).toBeNull()
  expect(screen.getByRole('heading', { name: 'the long summer' })).toBeInTheDocument()
})

it('calendar is an explicit way back from any section', async () => {
  show('/trip/summer?day=2027-06-28')
  await userEvent.click(screen.getByRole('button', { name: 'ideas' }))
  expect(screen.getByTestId('day-2027-06-28')).not.toBeVisible()
  expect(screen.getByRole('searchbox', { name: 'search ideas' })).toBeVisible()
  expect(screen.queryByRole('button', { name: /hide/ })).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'calendar' }))
  expect(screen.queryByRole('searchbox')).toBeNull()
  expect(screen.getByTestId('calendar')).toBeVisible()
  expect(screen.getByTestId('loc')).toHaveTextContent(/^\/trip\/summer$/)
})

it('creates ideas in ideas and notes from the itinerary', async () => {
  show('/trip/summer?tab=ideas')
  await userEvent.click(screen.getByRole('button', { name: 'add idea' }))
  expect(screen.getByRole('dialog', { name: 'new place' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'close' }))
  await userEvent.click(screen.getByRole('button', { name: 'calendar' }))
  await userEvent.click(screen.getByRole('button', { name: 'add note' }))
  expect(screen.getByRole('dialog', { name: 'new note' })).toBeInTheDocument()
})

it('calendar and itinerary are separate tabs and a calendar day opens itinerary', async () => {
  show('/trip/summer')
  await userEvent.click(screen.getByRole('button', { name: 'itinerary' }))
  expect(screen.getByTestId('day-2027-06-26')).toBeVisible()
  await userEvent.click(screen.getByRole('button', { name: 'calendar' }))
  expect(screen.getByTestId('calendar')).toBeVisible()
  await userEvent.click(screen.getByRole('button', { name: 'mon 28 jun' }))
  expect(screen.getByRole('button', { name: 'itinerary' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByTestId('day-2027-06-28')).toBeVisible()
})

it('shows unique destination flags from the side trip without its parent country or saved ideas', () => {
  db.trips = [trip({ id: 'parent', name: 'exchange', base: place({ country: 'NL' }) }), trip({ id: 'lap', name: 'lapland', parent_id: 'parent', base: null })]
  db.stops = [stop({ trip_id: 'lap', place: place({ country: 'FI' }) }), stop({ trip_id: 'lap', place: place({ country: 'fi' }) }), stop({ trip_id: 'lap', place: place({ country: 'SE' }) }), stop({ trip_id: 'lap', place: place({ country: 'FR' }), saved: true, day: null })]
  show('/trip/lap')
  const title = screen.getByRole('heading', { level: 1, name: /lapland/ })
  expect(within(title).getAllByRole('img').map(flag => flag.getAttribute('aria-label'))).toEqual(['Finland', 'Sweden'])
  expect(screen.queryByText(/side trip of/)).toBeNull()
})

it('caps multi-country titles at two flags and a compact remaining count', () => {
  db.trips = [trip({ id: 'europe', name: 'europe exchange', base: place({ country: 'NL' }) })]
  db.stops = ['FI', 'SE', 'FR'].map(country => stop({ trip_id: 'europe', place: place({ country }) }))
  show('/trip/europe')
  const heading = screen.getByRole('heading', { name: /europe exchange/ })
  expect(within(heading).getAllByRole('img')).toHaveLength(2)
  expect(within(heading).getByText('+2')).toBeInTheDocument()
})
