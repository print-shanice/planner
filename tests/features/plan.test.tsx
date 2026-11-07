import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { trip, stop, place } from '../factories'
import type { Stop, Trip } from '../../src/lib/types'

const db = vi.hoisted(() => ({
  stopsQ: null as null | Record<string, unknown>,
  trips: [] as unknown[],
  stops: [] as unknown[],
  save: vi.fn((r: unknown) => Promise.resolve(r)),
  walk: vi.fn(() => Promise.resolve(530)),
  search: vi.fn(),
  wide: false,
}))
vi.mock('../../src/lib/queries', () => ({
  useTrips: () => ({ data: db.trips }),
  useStops: () => db.stopsQ ?? ({ data: db.stops }),
  useCosts: () => ({ data: [] }),
  useFiles: () => ({ data: [] }),
  useMembers: () => ({ data: [] }),
  useRates: () => ({ data: null }),
  useSave: () => ({ mutateAsync: db.save, mutate: db.save, isPending: false }),
  useRemove: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('../../src/lib/useWide', () => ({ useWide: () => db.wide }))
vi.mock('../../src/lib/offline', () => ({ useCanEdit: () => true, useOnline: () => true }))
vi.mock('../../src/lib/walk', async (orig) => ({ ...(await orig<typeof import('../../src/lib/walk')>()), walkSeconds: db.walk }))
vi.mock('../../src/lib/photon', async (orig) => ({ ...(await orig<typeof import('../../src/lib/photon')>()), searchPlaces: db.search }))

import { PlanTab } from '../../src/features/plan/PlanTab'
import { failSave, forgetPending } from '../../src/lib/pending'

const lap = () => trip({ id: 'lap', name: 'lapland', start_date: '2027-02-07', end_date: '2027-02-11', base: place({ name: 'rovaniemi', lat: 66.5, lng: 25.7 }) })

function show(t: Trip) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter><PlanTab trip={t} /></MemoryRouter>
    </QueryClientProvider>,
  )
}

const day = (date: string) => screen.getByTestId(`day-${date}`)

function Probe() {
  const l = useLocation()
  return <output data-testid="loc">{l.pathname + l.search}</output>
}
function Routed() {
  const { id } = useParams()
  const t = (db.trips as Trip[]).find((x) => x.id === id)!
  return <PlanTab key={t.id} trip={t} />
}
// the plan inside a router, so tapping a day can move between trips
function showAt(path: string) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path="/trip/:id" element={<><Routed /><Probe /></>} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
const loc = () => screen.getByTestId('loc').textContent
const cal = () => within(screen.getByTestId('calendar'))


beforeEach(() => {
  db.wide = false
  db.save.mockClear(); db.walk.mockClear(); db.search.mockReset()
})

it('overview is the calendar: dated side trips are flagged bars, undated ones and day lists stay off it', () => {
  const t = lap()
  db.trips = [t,
    trip({ id: 'child', parent_id: t.id, name: 'day trip', start_date: '2027-02-08', end_date: '2027-02-09', base: place({ country: 'FR' }) }),
    trip({ id: 'later', parent_id: t.id, name: 'someday', start_date: null, end_date: null })]
  db.stops = [stop({ trip_id: t.id, title: 'loose idea', day: null })]
  show(t)
  expect(screen.queryByTestId(/^day-/)).toBeNull()
  expect(screen.queryByTestId('fold')).toBeNull()
  expect(screen.queryByText('someday')).toBeNull()
  expect(screen.queryByText('loose idea')).toBeNull()
  expect(screen.queryByText('your days')).toBeNull()
  expect(screen.queryByLabelText('jump to date')).toBeNull()
  const bar = cal().getByRole('link', { name: /day trip/ })
  expect(bar).toHaveAttribute('href', '/trip/child')
  expect(bar.textContent).toContain('🇫🇷')
})

it('the trip calendar is a whole month on a phone, without city bars, and marks days with plans', () => {
  const t = lap(); db.trips = [t]
  db.stops = [stop({ trip_id: t.id, title: 'museum', day: '2027-02-09' }),
    stop({ trip_id: t.id, kind: 'stay', title: 'cabin', day: '2027-02-07', end_date: '2027-02-11', place: place({ city: 'rovaniemi' }) })]
  show(t)
  expect(screen.queryByRole('button', { name: 'whole month' })).toBeNull()
  expect(cal().getByText('27')).toBeInTheDocument()
  expect(screen.queryByTestId('cal-city')).toBeNull()
  expect(cal().getByRole('button', { name: /tue 9 feb/ })).toHaveAttribute('data-planned', 'true')
  expect(cal().getByRole('button', { name: /wed 10 feb/ })).not.toHaveAttribute('data-planned')
})

it('a day opens as its own page with the date, its day number and nothing from the overview', () => {
  const t = lap(); db.trips = [t]; db.stops = [stop({ trip_id: t.id, title: 'museum', day: '2027-02-08' })]
  showAt('/trip/lap?day=2027-02-08')
  expect(screen.getByRole('heading', { name: 'monday 8 february' })).toBeInTheDocument()
  expect(screen.getByText(/day 2 of 5/)).toBeInTheDocument()
  expect(screen.queryByTestId('calendar')).toBeNull()
})

it('a date opens a single agenda without changing the parent, including nested plans', async () => {
  const t = lap()
  db.trips = [t, trip({ id: 'child', parent_id: t.id, name: 'side trip', start_date: '2027-02-08', end_date: '2027-02-09' })]
  db.stops = [stop({ trip_id: t.id, title: 'parent museum', day: '2027-02-08' }), stop({ trip_id: 'child', title: 'child cafe', day: '2027-02-08' })]
  showAt('/trip/lap')
  await userEvent.click(cal().getByRole('button', { name: 'mon 8 feb' }))
  expect(loc()).toBe('/trip/lap?day=2027-02-08')
  expect(screen.getAllByTestId(/^day-/)).toHaveLength(1)
  expect(within(day('2027-02-08')).getByText('parent museum')).toBeInTheDocument()
  expect(within(day('2027-02-08')).getByText('child cafe')).toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: /side trip.*open trip/ }).length).toBeGreaterThan(0)
})

it('empty long-trip dates can add directly to the parent and retain its stay', async () => {
  const t = trip({ id: 'exchange', start_date: '2027-01-01', end_date: '2027-07-01' })
  db.trips = [t]
  db.stops = [stop({ trip_id: t.id, kind: 'stay', title: 'home base', day: t.start_date, end_date: t.end_date })]
  const cafe = place({ name: 'local cafe' })
  db.search.mockResolvedValue([cafe])
  showAt('/trip/exchange?day=2027-04-12')
  expect(screen.getByText('staying at home base')).toBeInTheDocument()
  const d = day('2027-04-12')
  await userEvent.click(within(d).getByRole('button', { name: 'add a place' }))
  await userEvent.type(within(d).getByRole('searchbox'), 'cafe{Enter}')
  await userEvent.click(await within(d).findByRole('button', { name: /local cafe/ }))
  expect(db.save).toHaveBeenCalledWith(expect.objectContaining({ trip_id: t.id, day: '2027-04-12', place: cafe }))
})

it('timed stops sort chronologically, flexible plans follow and every stop is numbered', () => {
  const t = lap(); db.trips = [t]
  db.stops = [stop({ trip_id: t.id, title: 'lunch', day: '2027-02-08', time: '13:00', position: 0 }), stop({ trip_id: t.id, title: 'breakfast', day: '2027-02-08', time: '09:00', position: 1 }), stop({ trip_id: t.id, title: 'walk', day: '2027-02-08', time: null, position: 2 })]
  showAt('/trip/lap?day=2027-02-08')
  expect(within(day('2027-02-08')).getAllByTestId('stop-num').map(n => n.textContent)).toEqual(['1', '2', '3'])
  expect([...day('2027-02-08').querySelectorAll('.stop-title')].map(n => n.textContent)).toEqual(['breakfast', 'lunch', 'walk'])
  expect(screen.getByText('any time')).toBeInTheDocument()
})

it('date navigation changes only the selected day and returns to overview', async () => {
  const t = lap(); db.trips = [t]; db.stops = []
  showAt('/trip/lap?day=2027-02-08')
  await userEvent.click(within(screen.getByRole('navigation', { name: 'days' })).getByRole('button', { name: /tue 9 feb/ }))
  expect(loc()).toBe('/trip/lap?day=2027-02-09')
  expect(screen.getAllByTestId(/^day-/)).toHaveLength(1)
})

it('invalid and out-of-range dates show the overview safely', () => {
  const t = lap(); db.trips = [t]; db.stops = []
  showAt('/trip/lap?day=2027-02-30')
  expect(screen.getByTestId('calendar')).toBeInTheDocument()
})

it('undated trips retain their unscheduled places', () => {
  const t = trip({ id: 'idea', start_date: null, end_date: null }); db.trips = [t]
  db.stops = [stop({ trip_id: t.id, title: 'saved museum', day: null })]
  show(t)
  expect(screen.getByText('saved museum')).toBeInTheDocument()
})

it('failed refresh retains the selected agenda and offers retry', async () => {
  const t = lap(); db.trips = [t]
  const refetch = vi.fn()
  db.stopsQ = { data: [stop({ trip_id: t.id, title: 'museum', day: '2027-02-08' })], status: 'error', fetchStatus: 'idle', refetch }
  showAt('/trip/lap?day=2027-02-08')
  expect(screen.getByText('museum')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'retry' }))
  expect(refetch).toHaveBeenCalled()
})

it('failed stop saves remain visible in the agenda', async () => {
  const t = lap(); db.trips = [t]
  db.stops = [stop({ id: 'failed', trip_id: t.id, title: 'museum', day: '2027-02-08' })]
  failSave('stops', 'failed', { title: 'museum' }, false)
  showAt('/trip/lap?day=2027-02-08')
  expect(within(day('2027-02-08')).getByRole('alert')).toHaveTextContent("couldn't save")
})

beforeEach(() => { db.stopsQ = null })
afterEach(() => forgetPending())

it('choosing a date clears the saved-map override', async () => {
  const t = lap(); db.trips = [t]; db.stops = []
  showAt('/trip/lap?map=saved')
  await userEvent.click(cal().getByRole('button', { name: 'mon 8 feb' }))
  expect(loc()).toBe('/trip/lap?day=2027-02-08')
})

it('existing plans outside changed trip dates remain accessible', async () => {
  const t = lap(); db.trips = [t]
  db.stops = [stop({ trip_id: t.id, title: 'earlier arrival', day: '2027-02-01' })]
  showAt('/trip/lap')
  await userEvent.click(cal().getByRole('button', { name: /mon 1 feb/ }))
  expect(screen.getByText('earlier arrival')).toBeInTheDocument()
})

it('walking legs skip an unlocated note', () => {
  const t = lap(); db.trips = [t]
  db.stops = [stop({ trip_id: t.id, day: '2027-02-08', position: 0, place: place() }),
    stop({ trip_id: t.id, day: '2027-02-08', kind: 'note', position: 1, place: null }),
    stop({ trip_id: t.id, day: '2027-02-08', position: 2, place: place() })]
  showAt('/trip/lap?day=2027-02-08')
  expect(db.walk).not.toHaveBeenCalled()
})

it('a selected stay check-out remains visible', () => {
  const t = lap(); db.trips = [t]
  db.stops = [stop({ trip_id: t.id, kind: 'stay', title: 'hostel', day: '2027-02-07', end_date: '2027-02-09' })]
  showAt('/trip/lap?day=2027-02-09')
  expect(screen.getByText('check out · hostel')).toBeInTheDocument()
})
