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
// on a phone the calendar starts folded to one week
const wholeMonth = () => userEvent.click(cal().getByRole('button', { name: 'whole month' }))

beforeEach(() => {
  db.wide = false
  db.save.mockClear(); db.walk.mockClear(); db.search.mockReset()
})

it('numbers every stop and skips walking across an unlocated stop', async () => {
  const t = lap()
  db.trips = [t]
  db.stops = [
    stop({ trip_id: 'lap', title: 'arktikum', day: '2027-02-08', position: 0, place: place({ lat: 66.5, lng: 25.72 }) }),
    stop({ trip_id: 'lap', kind: 'note', title: 'buy gloves', day: '2027-02-08', position: 1, place: null }),
    stop({ trip_id: 'lap', title: 'santa village', day: '2027-02-08', position: 2, place: place({ lat: 66.54, lng: 25.84 }) }),
  ] as Stop[]
  show(t)
  const d = day('2027-02-08')
  expect(within(d).getAllByTestId('stop-num').map((n) => n.textContent)).toEqual(['1', '2', '3'])
  expect(within(d).queryByText(/min walk/)).toBeNull()
  expect(db.walk).not.toHaveBeenCalled()
})

it('shows walking time between two located stops', async () => {
  const t = lap()
  db.trips = [t]
  db.stops = [
    stop({ trip_id: 'lap', title: 'arktikum', day: '2027-02-08', position: 0, place: place({ lat: 66.5, lng: 25.72 }) }),
    stop({ trip_id: 'lap', title: 'santa village', day: '2027-02-08', position: 1, place: place({ lat: 66.54, lng: 25.84 }) }),
  ] as Stop[]
  show(t)
  expect(await within(day('2027-02-08')).findByText('9 min walk')).toBeInTheDocument()
})

it('stay shows on every covered day', () => {
  const t = lap()
  db.trips = [t]
  db.stops = [stop({ trip_id: 'lap', kind: 'stay', title: 'arctic hostel', day: '2027-02-07', end_date: '2027-02-09', status: 'booked' })] as Stop[]
  show(t)
  expect(within(day('2027-02-07')).getByText('arctic hostel')).toBeInTheDocument()
  expect(within(day('2027-02-07')).getByTestId('stop-num')).toHaveTextContent('1')
  expect(within(day('2027-02-07')).getByText('booked')).toHaveClass('ok')
  expect(within(day('2027-02-08')).getByText('staying at arctic hostel')).toBeInTheDocument()
  expect(within(day('2027-02-08')).queryByTestId('stop-num')).toBeNull()
  expect(within(day('2027-02-09')).getByText('check out · arctic hostel')).toBeInTheDocument()
})

it('a clashing stay is flagged in words', () => {
  const t = lap()
  db.trips = [t]
  db.stops = [
    stop({ trip_id: 'lap', kind: 'stay', title: 'a', day: '2027-02-07', end_date: '2027-02-09' }),
    stop({ trip_id: 'lap', kind: 'stay', title: 'b', day: '2027-02-08', end_date: '2027-02-10' }),
  ] as Stop[]
  show(t)
  expect(within(day('2027-02-07')).getByText('dates clash')).toHaveClass('warn')
})

it('a journey shows its mode and times', () => {
  const t = lap()
  db.trips = [t]
  db.stops = [stop({ trip_id: 'lap', kind: 'journey', title: 'fly to rovaniemi', day: '2027-02-07', mode: 'flight', time: '14:10', end_time: '18:20' })] as Stop[]
  show(t)
  expect(within(day('2027-02-07')).getByText('flight · 14:10–18:20')).toBeInTheDocument()
})

it('adding a place puts it at the end of that day', async () => {
  const t = lap()
  db.trips = [t]
  db.stops = [
    stop({ trip_id: 'lap', title: 'one', day: '2027-02-08', position: 0 }),
    stop({ trip_id: 'lap', title: 'two', day: '2027-02-08', position: 1 }),
  ] as Stop[]
  const arktikum = { name: 'Arktikum', address: 'Pohjoisranta 4, Rovaniemi', city: 'Rovaniemi', country: 'FI', lat: 66.5079, lng: 25.7287 }
  db.search.mockResolvedValue([arktikum])
  show(t)
  const d = day('2027-02-08')
  await userEvent.click(within(d).getByRole('button', { name: 'add a place' }))
  await userEvent.type(within(d).getByRole('searchbox'), 'arktikum{Enter}')
  await userEvent.click(await within(d).findByRole('button', { name: /Arktikum/ }))
  expect(db.search).toHaveBeenCalledWith('arktikum', { lat: 66.5, lng: 25.7 })
  expect(db.save).toHaveBeenCalledWith(expect.objectContaining({
    trip_id: 'lap', kind: 'place', title: 'Arktikum', day: '2027-02-08', position: 2, place: arktikum,
  }))
})

it('failed search offers retry', async () => {
  const t = lap()
  db.trips = [t]
  db.stops = []
  db.search.mockRejectedValueOnce(new Error('503')).mockResolvedValueOnce([])
  show(t)
  const d = day('2027-02-07')
  await userEvent.click(within(d).getByRole('button', { name: 'add a place' }))
  await userEvent.type(within(d).getByRole('searchbox'), 'x{Enter}')
  expect(await within(d).findByText("search isn't responding")).toBeInTheDocument()
  await userEvent.click(within(d).getByRole('button', { name: 'retry' }))
  expect(db.search).toHaveBeenCalledTimes(2)
})

it('a dateless trip still renders its undated stops', () => {
  const t = trip({ id: 'someday', name: 'japan someday', start_date: null, end_date: null })
  db.trips = [t]
  db.stops = [stop({ trip_id: 'someday', title: 'fushimi inari', day: null })] as Stop[]
  show(t)
  const nd = screen.getByRole('region', { name: 'no date' })
  expect(within(nd).getByText('fushimi inari')).toBeInTheDocument()
  expect(within(nd).getByRole('button', { name: 'add a place' })).toBeInTheDocument()
})

const feb = () => {
  const eu = trip({ id: 'eu', name: 'europe', start_date: '2027-02-01', end_date: '2027-02-14', base: place({ name: 'eindhoven', city: 'eindhoven' }) })
  const kid = trip({ id: 'lap', parent_id: 'eu', name: 'lapland', start_date: '2027-02-07', end_date: '2027-02-11', color: 1 })
  return [eu, kid] as Trip[]
}

it("a side trip's days fold into one row that opens it", () => {
  db.trips = feb()
  db.stops = []
  show(db.trips[0] as Trip)
  const fold = screen.getByTestId('fold')
  expect(fold).toHaveAttribute('href', '/trip/lap')
  expect(fold).toHaveTextContent('lapland')
  expect(fold).toHaveTextContent('7 – 11 feb · 5 days')
  expect(screen.queryByTestId('day-2027-02-08')).toBeNull()
  expect(screen.queryByTestId('day-2027-02-07')).toBeNull()
  expect(day('2027-02-06')).toBeInTheDocument()
  expect(day('2027-02-12')).toBeInTheDocument()
})

it("the parent's own plans on a side-trip day still show", () => {
  db.trips = feb()
  db.stops = [stop({ trip_id: 'eu', title: 'pay rent', day: '2027-02-09' })] as Stop[]
  show(db.trips[0] as Trip)
  expect(within(day('2027-02-09')).getByText('pay rent')).toBeInTheDocument()
  expect(screen.getByTestId('fold')).toBeInTheDocument()
})

it('the trip calendar shows its side trips and the city you sleep in', async () => {
  db.trips = feb()
  db.stops = [stop({ trip_id: 'eu', kind: 'stay', title: 'hotel v', day: '2027-02-02', end_date: '2027-02-04', place: place({ name: 'hotel v', city: 'amsterdam' }) })] as Stop[]
  show(db.trips[0] as Trip)
  await wholeMonth()
  const cal = screen.getByTestId('calendar')
  expect(within(cal).getByText('february')).toBeInTheDocument()
  expect(within(cal).getAllByTestId('cal-bar').map((b) => b.textContent)).toEqual(['lapland', 'lapland'])
  expect(within(cal).getAllByTestId('cal-city').map((b) => b.textContent)).toEqual(['eindhoven', 'amsterdam', 'eindhoven', 'eindhoven'])
  // only this trip's months
  expect(screen.getByRole('button', { name: 'previous month' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'next month' })).toBeDisabled()
  // days outside the trip can't be picked
  expect(screen.queryByRole('button', { name: 'mon 15 feb' })).toBeNull()
})

it('a short side trip has its calendar too', () => {
  const t = lap()
  db.trips = [t]
  db.stops = []
  show(t)
  expect(cal().getByText('february')).toBeInTheDocument()
  expect(screen.getByTestId('calendar').querySelector('[data-day="2027-02-07"]')).toHaveAttribute('data-ribbon', 'start')
})

it('on a phone the calendar folds to one week, moves by week and opens to the whole month', async () => {
  db.trips = feb()
  db.stops = []
  show(db.trips[0] as Trip)
  const days = () => [...screen.getByTestId('calendar').querySelectorAll('[data-day]')].map((d) => d.getAttribute('data-day'))
  expect(days()).toEqual(['2027-02-01', '2027-02-02', '2027-02-03', '2027-02-04', '2027-02-05', '2027-02-06', '2027-02-07'])
  expect(cal().getByRole('button', { name: 'whole month' })).toHaveAttribute('aria-expanded', 'false')
  expect(cal().getByRole('button', { name: 'previous week' })).toBeDisabled()
  await userEvent.click(cal().getByRole('button', { name: 'next week' }))
  expect(days()[0]).toBe('2027-02-08')
  expect(cal().getByRole('button', { name: 'next week' })).toBeDisabled()
  await wholeMonth()
  expect(days()).toHaveLength(28)
  expect(cal().getByRole('button', { name: 'whole month' })).toHaveAttribute('aria-expanded', 'true')
})

it('on a laptop the calendar always shows the whole month', () => {
  db.wide = true
  db.trips = feb()
  db.stops = []
  show(db.trips[0] as Trip)
  expect(screen.getByTestId('calendar').querySelectorAll('[data-day]')).toHaveLength(28)
  expect(screen.queryByRole('button', { name: 'whole month' })).toBeNull()
})

it('tapping a day selects it and puts it in the url', async () => {
  db.trips = feb()
  db.stops = []
  showAt('/trip/eu')
  await userEvent.click(cal().getByRole('button', { name: 'fri 5 feb' }))
  expect(loc()).toBe('/trip/eu?day=2027-02-05')
  expect(cal().getByRole('button', { name: 'fri 5 feb' })).toHaveAttribute('aria-pressed', 'true')
  expect(within(screen.getByRole('navigation', { name: 'days' })).getByRole('button', { name: 'fri 5 feb' })).toHaveAttribute('aria-current', 'true')
})

it('tapping a day inside a side trip opens the side trip on that day', async () => {
  db.trips = feb()
  db.stops = []
  showAt('/trip/eu')
  await userEvent.click(cal().getByRole('button', { name: 'next week' }))
  await userEvent.click(cal().getByRole('button', { name: 'mon 8 feb' }))
  expect(loc()).toBe('/trip/lap?day=2027-02-08')
  // lapland opens on that week with the day picked
  expect(cal().getByRole('button', { name: 'mon 8 feb' })).toHaveAttribute('aria-pressed', 'true')
  expect(within(screen.getByRole('navigation', { name: 'days' })).getByRole('button', { name: 'mon 8 feb' })).toHaveAttribute('aria-current', 'true')
})

it('long trips list only busy days, and the calendar opens any day', async () => {
  const t = trip({ id: 'eu', name: 'europe', start_date: '2027-01-28', end_date: '2027-07-13' })
  db.trips = [t]
  db.stops = [stop({ trip_id: 'eu', title: 'museum', day: '2027-03-02' })] as Stop[]
  showAt('/trip/eu')
  expect(screen.getAllByTestId(/^day-/)).toHaveLength(1)
  expect(screen.queryByLabelText('pick a date')).toBeNull()
  expect(within(screen.getByTestId('calendar')).getByText('january')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'sat 30 jan' }))
  expect(day('2027-01-30')).toBeInTheDocument()
})

it('opening a trip at a day shows that month and that day', () => {
  const t = trip({ id: 'eu', name: 'europe', start_date: '2027-01-28', end_date: '2027-07-13' })
  db.trips = [t]
  db.stops = []
  showAt('/trip/eu?day=2027-03-05')
  expect(within(screen.getByTestId('calendar')).getByText('march')).toBeInTheDocument()
  expect(within(screen.getByTestId('calendar')).getByRole('button', { name: 'fri 5 mar' })).toHaveAttribute('aria-pressed', 'true')
  expect(day('2027-03-05')).toBeInTheDocument()
})

it('undated side trips are always listed, with set dates', async () => {
  const [eu] = feb()
  const rome = trip({ id: 'rome', parent_id: 'eu', name: 'someday rome', start_date: null, end_date: null })
  db.trips = [eu, rome]
  db.stops = []
  show(eu)
  const nd = screen.getByRole('region', { name: 'no date' })
  expect(within(nd).getByRole('link', { name: /someday rome/ })).toHaveAttribute('href', '/trip/rome')
  await userEvent.click(within(nd).getByRole('button', { name: 'set dates' }))
  expect(within(screen.getByRole('dialog', { name: 'edit trip' })).getByDisplayValue('someday rome')).toBeInTheDocument()
})

it('day chips name the month, and a folded side trip gets one chip', () => {
  db.trips = feb()
  db.stops = []
  show(db.trips[0] as Trip)
  const chips = within(screen.getByRole('navigation', { name: 'days' })).getAllByRole('button').map((b) => b.textContent)
  expect(chips.slice(0, 2)).toEqual(['mon1feb', 'tue2feb'])
  expect(chips).toContain('lapland')
  expect(chips).not.toContain('mon8feb')
})

it('month headings split a plan that spans months', () => {
  const t = trip({ id: 'nye', name: 'new year', start_date: '2026-12-28', end_date: '2027-01-03' })
  db.trips = [t]
  db.stops = []
  show(t)
  expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['december 2026', 'january 2027'])
})

const loading = { data: undefined, status: 'pending', fetchStatus: 'fetching' }

beforeEach(() => { db.stopsQ = null })

it('stops still loading show grey rows instead of empty days', () => {
  const t = lap()
  db.trips = [t]
  db.stopsQ = loading
  show(t)
  expect(screen.getByRole('status', { name: 'loading' })).toBeInTheDocument()
  expect(screen.queryByTestId('day-2027-02-07')).toBeNull()
})

it('a failed refresh keeps the saved plan with a retry', async () => {
  const t = lap()
  db.trips = [t]
  const refetch = vi.fn()
  db.stopsQ = { data: [stop({ trip_id: 'lap', title: 'arktikum', day: '2027-02-08' })], status: 'error', fetchStatus: 'idle', refetch }
  show(t)
  expect(screen.getByText('arktikum')).toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent("couldn't load")
  await userEvent.click(screen.getByRole('button', { name: 'retry' }))
  expect(refetch).toHaveBeenCalled()
})

afterEach(() => forgetPending())

it('a stop whose save failed says so on its row', async () => {
  const t = lap()
  db.trips = [t]
  db.stops = [stop({ id: 'x1', trip_id: 'lap', title: 'arktikum', day: '2027-02-08' })]
  failSave('stops', 'x1', { title: 'arktikum' }, false)
  show(t)
  expect(within(day('2027-02-08')).getByRole('alert')).toHaveTextContent("couldn't save")
  await userEvent.click(within(day('2027-02-08')).getByRole('button', { name: 'retry' }))
  expect(db.save).toHaveBeenCalledWith({ id: 'x1', title: 'arktikum' })
})

it('overlapping side trips show one clash row naming both, and adjust dates opens the later trip', async () => {
  const eu = trip({ id: 'eu', name: 'euro summer', start_date: '2027-06-01', end_date: '2027-07-01' })
  const rome = trip({ id: 'rome', parent_id: 'eu', name: 'rome', start_date: '2027-06-12', end_date: '2027-06-16', color: 1 })
  const flo = trip({ id: 'flo', parent_id: 'eu', name: 'florence', start_date: '2027-06-14', end_date: '2027-06-18', color: 2 })
  db.trips = [eu, rome, flo]
  db.stops = []
  show(eu)
  const row = screen.getByText('rome and florence · 14 – 16 jun').closest('.notice') as HTMLElement
  expect(row).toHaveTextContent('dates clash')
  // the folded side-trip rows carry the pill too
  expect(screen.getAllByText('dates clash').filter((el) => el.classList.contains('pill'))).toHaveLength(2)
  await userEvent.click(within(row).getByRole('button', { name: 'adjust dates' }))
  const sheet = screen.getByRole('dialog', { name: 'edit trip' })
  expect(within(sheet).getByDisplayValue('florence')).toBeInTheDocument()
})

it('a side trip sees its clash too', () => {
  const eu = trip({ id: 'eu', name: 'euro summer', start_date: '2027-06-01', end_date: '2027-07-01' })
  const rome = trip({ id: 'rome', parent_id: 'eu', name: 'rome', start_date: '2027-06-12', end_date: '2027-06-16' })
  const flo = trip({ id: 'flo', parent_id: 'eu', name: 'florence', start_date: '2027-06-14', end_date: '2027-06-18' })
  db.trips = [eu, rome, flo]
  db.stops = []
  show(rome)
  expect(screen.getByText('rome and florence · 14 – 16 jun')).toBeInTheDocument()
})
