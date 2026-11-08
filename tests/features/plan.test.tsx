import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { trip, stop, place } from '../factories'
import type { Stop, Trip } from '../../src/lib/types'

const db = vi.hoisted(() => ({
  stopsQ: null as null | Record<string, unknown>,
  trips: [] as unknown[],
  stops: [] as unknown[],
  costs: [] as unknown[],
  save: vi.fn((r: unknown) => Promise.resolve(r)),
  walk: vi.fn(() => Promise.resolve(530)),
  search: vi.fn(),
  wide: false,
}))
vi.mock('../../src/lib/queries', () => ({
  useTrips: () => ({ data: db.trips }),
  useStops: () => db.stopsQ ?? ({ data: db.stops }),
  useCosts: () => ({ data: db.costs }),
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
import { directionsUrl } from '../../src/lib/gmaps'

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

it('the calendar flags dated side trips; undated ones and loose ideas stay off the plan', () => {
  const t = lap()
  db.trips = [t,
    trip({ id: 'child', parent_id: t.id, name: 'day trip', start_date: '2027-02-08', end_date: '2027-02-09', base: place({ country: 'FR' }) }),
    trip({ id: 'later', parent_id: t.id, name: 'someday', start_date: null, end_date: null })]
  db.stops = [stop({ trip_id: t.id, title: 'loose idea', day: null })]
  db.wide = true
  show(t)
  expect(day('2027-02-07')).toBeInTheDocument()
  expect(screen.queryByText('someday')).toBeNull()
  expect(screen.queryByText('loose idea')).toBeNull()
  const label = cal().getByRole('link', { name: /day trip/ })
  expect(label).toHaveAttribute('href', '/trip/child')
  expect(label.textContent).toContain('🇫🇷')
  expect(screen.queryByTestId('cal-bar')).toBeNull()
  expect(cal().getByRole('button', { name: 'mon 8 feb' })).toHaveAttribute('data-side', 'start')
  expect(cal().getByRole('button', { name: 'tue 9 feb' })).toHaveAttribute('data-side', 'end')
  expect(cal().getByRole('button', { name: 'wed 10 feb' })).not.toHaveAttribute('data-side')
})

it('phones fold the calendar to the chosen week; the chevron opens the whole month', async () => {
  const t = lap(); db.trips = [t]
  db.stops = [stop({ trip_id: t.id, title: 'museum', day: '2027-02-09' }),
    stop({ trip_id: t.id, kind: 'stay', title: 'cabin', day: '2027-02-07', end_date: '2027-02-11', place: place({ city: 'rovaniemi' }) })]
  showAt('/trip/lap?day=2027-02-09')
  expect(cal().getAllByRole('button', { name: /feb/ }).map((b) => b.getAttribute('aria-label'))).toEqual(['mon 8 feb', 'tue 9 feb', 'wed 10 feb', 'thu 11 feb'])
  expect(cal().getByRole('button', { name: 'tue 9 feb' })).toHaveAttribute('aria-pressed', 'true')
  expect(cal().getByRole('button', { name: 'tue 9 feb' })).toHaveAttribute('data-planned', 'true')
  expect(screen.queryByTestId('cal-city')).toBeNull()
  await userEvent.click(cal().getByRole('button', { name: 'whole month' }))
  expect(cal().getByRole('button', { name: 'sun 7 feb' })).toBeInTheDocument()
  expect(cal().getByText('27')).toBeInTheDocument()
})

it('laptops always show the whole month', () => {
  const t = lap(); db.trips = [t]; db.stops = []
  db.wide = true
  showAt('/trip/lap?day=2027-02-09')
  expect(screen.queryByRole('button', { name: 'whole month' })).toBeNull()
  expect(cal().getByText('27')).toBeInTheDocument()
})

it('the chosen day shows under the calendar with its date and day number', () => {
  const t = lap(); db.trips = [t]; db.stops = [stop({ trip_id: t.id, title: 'museum', day: '2027-02-08' })]
  showAt('/trip/lap?day=2027-02-08')
  expect(screen.getByTestId('calendar')).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: 'monday 8 february' })).toBeInTheDocument()
  expect(screen.getByText(/day 2 of 5/)).toBeInTheDocument()
  expect(within(day('2027-02-08')).getByText('museum')).toBeInTheDocument()
})

it('the chosen day ends with a line to type into, and so does "no date"', async () => {
  const t = lap(); db.trips = [t]; db.stops = []
  showAt('/trip/lap?day=2027-02-08')
  await userEvent.type(screen.getByRole('textbox', { name: 'add to mon 8 feb' }), 'sauna{Enter}')
  expect(db.save).toHaveBeenCalledWith(expect.objectContaining({ trip_id: 'lap', day: '2027-02-08', title: 'sauna' }))
})

it('an undated trip ends its "no date" list with a line to type into', () => {
  db.trips = [trip({ id: 'some', start_date: null, end_date: null })]
  db.stops = []
  showAt('/trip/some')
  expect(screen.getByRole('textbox', { name: 'add to no date' })).toBeInTheDocument()
})

it('without a day in the link, the plan opens on the first day of the trip', () => {
  const t = lap(); db.trips = [t]; db.stops = []
  showAt('/trip/lap')
  expect(screen.getByRole('heading', { level: 2, name: 'sunday 7 february' })).toBeInTheDocument()
  expect(cal().getByRole('button', { name: 'sun 7 feb' })).toHaveAttribute('aria-pressed', 'true')
})

it('a parent day deep link still includes nested plans', () => {
  const t = lap()
  db.trips = [t, trip({ id: 'child', parent_id: t.id, name: 'side trip', start_date: '2027-02-08', end_date: '2027-02-09' })]
  db.stops = [stop({ trip_id: t.id, title: 'parent museum', day: '2027-02-08' }), stop({ trip_id: 'child', title: 'child cafe', day: '2027-02-08' })]
  showAt('/trip/lap?day=2027-02-08')
  expect(loc()).toBe('/trip/lap?day=2027-02-08')
  expect(screen.getAllByTestId(/^day-/)).toHaveLength(1)
  expect(within(day('2027-02-08')).getByText('parent museum')).toBeInTheDocument()
  expect(within(day('2027-02-08')).getByText('child cafe')).toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: /side trip.*open trip/ }).length).toBeGreaterThan(0)
})

it('an empty day in a long trip still shows the stay around it', () => {
  const t = trip({ id: 'exchange', start_date: '2027-01-01', end_date: '2027-07-01' })
  db.trips = [t]
  db.stops = [stop({ trip_id: t.id, kind: 'stay', title: 'home base', day: t.start_date, end_date: t.end_date })]
  showAt('/trip/exchange?day=2027-04-12')
  expect(screen.getByText('staying at home base')).toBeInTheDocument()
  expect(within(day('2027-04-12')).queryByRole('button', { name: 'add a place' })).toBeNull()
})
it('timed stops sort chronologically, flexible plans follow and every stop is numbered', () => {
  const t = lap(); db.trips = [t]
  db.stops = [stop({ trip_id: t.id, title: 'lunch', day: '2027-02-08', time: '13:00', position: 0 }), stop({ trip_id: t.id, title: 'breakfast', day: '2027-02-08', time: '09:00', position: 1 }), stop({ trip_id: t.id, title: 'walk', day: '2027-02-08', time: null, position: 2 })]
  showAt('/trip/lap?day=2027-02-08')
  expect(within(day('2027-02-08')).getAllByTestId('stop-num').map(n => n.textContent)).toEqual(['1', '2', '3'])
  expect([...day('2027-02-08').querySelectorAll('.stop-title')].map(n => n.textContent)).toEqual(['breakfast', 'lunch', 'walk'])
  expect(screen.queryByText('any time')).toBeNull()
})

it('tapping a day in the calendar changes only the chosen day', async () => {
  const t = lap(); db.trips = [t]; db.stops = []
  showAt('/trip/lap?day=2027-02-08')
  await userEvent.click(cal().getByRole('button', { name: 'tue 9 feb' }))
  expect(loc()).toBe('/trip/lap?day=2027-02-09')
  expect(screen.getAllByTestId(/^day-/)).toHaveLength(1)
  expect(screen.getByRole('heading', { level: 2, name: 'tuesday 9 february' })).toBeInTheDocument()
})

it('invalid and out-of-range dates fall back to the first day', () => {
  const t = lap(); db.trips = [t]; db.stops = []
  showAt('/trip/lap?day=2027-02-30')
  expect(screen.getByTestId('calendar')).toBeInTheDocument()
  expect(day('2027-02-07')).toBeInTheDocument()
})

it('a trip with no dates shows "no date" and no calendar', () => {
  db.trips = [trip({ id: 'some', start_date: null, end_date: null })]
  db.stops = [stop({ trip_id: 'some', title: 'loose', day: null })]
  showAt('/trip/some')
  expect(screen.queryByTestId('calendar')).toBeNull()
  expect(screen.getByRole('region', { name: 'no date' })).toHaveTextContent('loose')
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
  db.wide = true
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

it('a leg jumps over an unlocated note', () => {
  const t = lap(); db.trips = [t]
  db.stops = [stop({ trip_id: t.id, day: '2027-02-08', position: 0, place: place({ lat: 66.50, lng: 25.70 }) }),
    stop({ trip_id: t.id, day: '2027-02-08', kind: 'note', title: 'a note', position: 1, place: null }),
    stop({ trip_id: t.id, day: '2027-02-08', position: 2, place: place({ lat: 66.51, lng: 25.72 }) })]
  showAt('/trip/lap?day=2027-02-08')
  expect(db.walk).toHaveBeenCalledTimes(1)
  const link = day('2027-02-08').querySelector('a.leg') as HTMLElement
  const note = [...day('2027-02-08').querySelectorAll('.stop-row')].find((r) => r.textContent?.includes('a note')) as HTMLElement
  expect(link.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

it('a leg links to google maps directions', async () => {
  const t = lap(); db.trips = [t]
  const a = place({ lat: 66.50, lng: 25.70 }), b = place({ lat: 66.51, lng: 25.72 })
  db.stops = [stop({ trip_id: t.id, title: 'a', day: '2027-02-08', time: '10:00', place: a }),
    stop({ trip_id: t.id, title: 'b', day: '2027-02-08', time: null, position: 1, place: b })]
  showAt('/trip/lap?day=2027-02-08')
  const link = await within(day('2027-02-08')).findByRole('link', { name: '9 min walk' })
  expect(link).toHaveAttribute('href', directionsUrl(a, b))
  expect(link).toHaveAttribute('target', '_blank')
})

it('a long walk still gives directions', async () => {
  db.walk.mockResolvedValueOnce(9000)
  const t = lap(); db.trips = [t]
  db.stops = [stop({ trip_id: t.id, title: 'a', day: '2027-02-08', time: '10:00', place: place({ lat: 66.50, lng: 25.70 }) }),
    stop({ trip_id: t.id, title: 'b', day: '2027-02-08', time: null, position: 1, place: place({ lat: 66.51, lng: 25.72 }) })]
  showAt('/trip/lap?day=2027-02-08')
  expect(await within(day('2027-02-08')).findByRole('link', { name: 'directions' })).toHaveTextContent('directions')
})

it('the evening leg goes back to the bed', async () => {
  const t = lap(); db.trips = [t]
  const bed = place({ lat: 66.50, lng: 25.70 }), museum = place({ lat: 66.52, lng: 25.75 })
  db.stops = [stop({ trip_id: t.id, kind: 'stay', title: 'hostel', day: '2027-02-07', end_date: '2027-02-10', place: bed }),
    stop({ trip_id: t.id, title: 'museum', day: '2027-02-08', place: museum })]
  showAt('/trip/lap?day=2027-02-08')
  await within(day('2027-02-08')).findAllByRole('link', { name: /walk|directions/ })
  const hrefs = [...day('2027-02-08').querySelectorAll('a.leg')].map((l) => l.getAttribute('href'))
  expect(hrefs).toEqual([directionsUrl(bed, museum), directionsUrl(museum, bed)])
})

it('a selected stay check-out remains visible', () => {
  const t = lap(); db.trips = [t]
  db.stops = [stop({ trip_id: t.id, kind: 'stay', title: 'hostel', day: '2027-02-07', end_date: '2027-02-09' })]
  showAt('/trip/lap?day=2027-02-09')
  expect(screen.getByText('check out · hostel')).toBeInTheDocument()
})

it('labels a side trip once across weeks and opens its overview from a highlighted day', async () => {
  const t = lap()
  db.trips = [t, trip({ id: 'child', parent_id: t.id, name: 'winter escape', start_date: '2027-02-07', end_date: '2027-02-10', base: place({ country: 'FI' }) })]
  db.stops = []
  db.wide = true
  showAt('/trip/lap')
  expect(cal().getAllByRole('link', { name: /winter escape/ })).toHaveLength(1)
  await userEvent.click(cal().getByRole('button', { name: 'tue 9 feb' }))
  expect(loc()).toBe('/trip/child?day=2027-02-09')
})

it('the week moves on and back across months', async () => {
  db.trips = [trip({ id: 'long', start_date: '2027-01-28', end_date: '2027-03-03' })]
  db.stops = []
  showAt('/trip/long?day=2027-01-28')
  expect(cal().getByText('january')).toBeInTheDocument()
  await userEvent.click(cal().getByRole('button', { name: 'next week' }))
  expect(cal().getByRole('button', { name: 'mon 1 feb' })).toBeInTheDocument()
  expect(cal().getByText('february')).toBeInTheDocument()
  await userEvent.click(cal().getByRole('button', { name: 'wed 3 feb' }))
  expect(loc()).toBe('/trip/long?day=2027-02-03')
  await userEvent.click(cal().getByRole('button', { name: 'previous week' }))
  await userEvent.click(cal().getByRole('button', { name: 'thu 28 jan' }))
  expect(day('2027-01-28')).toBeInTheDocument()
})

describe('a calm day', () => {
  const at = (lat: number, lng: number, o: Partial<import('../../src/lib/types').Place> = {}) => place({ lat, lng, ...o })
  const rows = () => [...day('2027-02-08').querySelectorAll('.stop-row')] as HTMLElement[]

  it('a timed place shows its time once, and its line under says what and where', () => {
    const t = lap(); db.trips = [t]
    db.stops = [stop({ trip_id: t.id, title: 'arktikum', day: '2027-02-08', time: '10:00', category: 'museum', place: at(66.5, 25.7, { city: 'rovaniemi' }) })]
    showAt('/trip/lap?day=2027-02-08')
    expect(within(day('2027-02-08')).getAllByText('10:00')).toHaveLength(1)
    expect(within(day('2027-02-08')).getByText('museum · rovaniemi')).toBeInTheDocument()
  })

  it('untimed stops follow with no "any time" heading, marked "any" when the day has times', () => {
    const t = lap(); db.trips = [t]
    db.stops = [stop({ trip_id: t.id, title: 'lunch', day: '2027-02-08', time: '13:00' }), stop({ trip_id: t.id, title: 'walk', day: '2027-02-08', time: null, position: 1 })]
    showAt('/trip/lap?day=2027-02-08')
    expect(screen.queryByText('any time')).toBeNull()
    expect(within(rows()[1]).getByText('any')).toBeInTheDocument()
  })

  it('a day with no times shows no "any"', () => {
    const t = lap(); db.trips = [t]
    db.stops = [stop({ trip_id: t.id, title: 'walk', day: '2027-02-08', time: null })]
    showAt('/trip/lap?day=2027-02-08')
    expect(screen.queryByText('any')).toBeNull()
  })

  it('a walk shows between every pair of located places, timed to untimed too', async () => {
    const t = lap(); db.trips = [t]
    db.stops = [stop({ trip_id: t.id, title: 'a', day: '2027-02-08', time: '10:00', place: at(66.50, 25.70) }),
      stop({ trip_id: t.id, title: 'b', day: '2027-02-08', time: null, position: 1, place: at(66.51, 25.72) })]
    showAt('/trip/lap?day=2027-02-08')
    expect(await within(day('2027-02-08')).findByText('9 min walk')).toBeInTheDocument()
  })

  it('no walk between two places under 150 m apart', () => {
    const t = lap(); db.trips = [t]
    db.stops = [stop({ trip_id: t.id, kind: 'journey', title: 'flight', day: '2027-02-08', time: '07:00', origin: at(53.4, -6.2), destination: at(52.31, 4.76) }),
      stop({ trip_id: t.id, kind: 'journey', title: 'train', day: '2027-02-08', time: '15:00', origin: at(52.3101, 4.7601), destination: at(51.44, 5.47) })]
    showAt('/trip/lap?day=2027-02-08')
    expect(db.walk).not.toHaveBeenCalled()
  })

  it('a journey reads like a ticket: both ends in full, when it lands, mode, ref and status', () => {
    const t = lap(); db.trips = [t]
    db.stops = [stop({ trip_id: t.id, kind: 'journey', mode: 'flight', title: 'flight to amsterdam', day: '2027-02-08', time: '07:10', end_time: '14:35', ref: 'KL934', status: 'booked',
      origin: at(53.4, -6.2, { name: 'dublin airport', city: 'dublin' }), destination: at(52.31, 4.76, { name: 'schiphol', city: 'amsterdam' }) })]
    showAt('/trip/lap?day=2027-02-08')
    const ticket = within(day('2027-02-08').querySelector('.journey-ticket') as HTMLElement)
    expect(ticket.getByText('dublin airport')).toBeInTheDocument()
    expect(ticket.getByText('schiphol')).toBeInTheDocument()
    expect(ticket.getByText('lands 14:35')).toBeInTheDocument()
    expect(ticket.getByText(/KL934/)).toBeInTheDocument()
    expect(ticket.getByText('booked')).toBeInTheDocument()
    expect(within(day('2027-02-08')).getAllByText('07:10')).toHaveLength(1)
  })

  it('a train says it arrives', () => {
    const t = lap(); db.trips = [t]
    db.stops = [stop({ trip_id: t.id, kind: 'journey', mode: 'train', day: '2027-02-08', time: '15:30', end_time: '16:50', origin: at(52.31, 4.76, { name: 'schiphol' }), destination: at(51.44, 5.47, { name: 'eindhoven centraal' }) })]
    showAt('/trip/lap?day=2027-02-08')
    expect(within(day('2027-02-08')).getByText('arrives 16:50')).toBeInTheDocument()
  })

  it('a stay starting that day is a quiet check-in strip, and numbering skips it', () => {
    const t = lap(); db.trips = [t]
    db.stops = [stop({ trip_id: t.id, kind: 'stay', title: 'cabin', day: '2027-02-08', end_date: '2027-02-10' }),
      stop({ trip_id: t.id, title: 'museum', day: '2027-02-08', time: '10:00' }),
      stop({ trip_id: t.id, kind: 'note', title: 'buy snacks', day: '2027-02-08', time: '12:00' })]
    showAt('/trip/lap?day=2027-02-08')
    expect(within(day('2027-02-08')).getByText('check in · cabin')).toBeInTheDocument()
    expect(within(day('2027-02-08')).getAllByTestId('stop-num').map((n) => n.textContent)).toEqual(['1', '2'])
  })

  it('the day heading only says which day of the trip it is', () => {
    const t = lap(); db.trips = [t]
    db.stops = [stop({ id: 'm', trip_id: t.id, title: 'museum', day: '2027-02-08' })]
    db.costs = [{ id: 'c', trip_id: t.id, stop_id: 'm', title: 'museum', amount: 3442, currency: 'EUR', eur_rate: null, category: 'other', date: '2027-02-08', status: 'paid', paid_by: null, split: 'even' }]
    showAt('/trip/lap?day=2027-02-08')
    db.costs = []
    expect(screen.getByText('day 2 of 5')).toBeInTheDocument()
    expect(screen.getByText('day 2 of 5').textContent).toBe('day 2 of 5')
  })

  it('stop numbers wear the trip colour', () => {
    const t = { ...lap(), color: 3 }; db.trips = [t]
    db.stops = [stop({ trip_id: t.id, title: 'museum', day: '2027-02-08' })]
    showAt('/trip/lap?day=2027-02-08')
    expect(within(day('2027-02-08')).getByTestId('stop-num').style.background).toBe('var(--g3)')
  })
})

it('hovering or focusing a stop lights it for the map, and leaving clears it', async () => {
  const { HighlightProvider, useHighlight } = await import('../../src/features/trip/highlight')
  const { StopSheetProvider } = await import('../../src/features/stops/StopSheet')
  function Lit() { return <output data-testid="lit">{useHighlight().id ?? ''}</output> }
  const t = lap(); db.trips = [t]
  db.stops = [stop({ id: 's1', trip_id: t.id, title: 'museum', day: '2027-02-08' })]
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/trip/lap?day=2027-02-08']}><StopSheetProvider><HighlightProvider><Routes><Route path="/trip/:id" element={<><Routed /><Lit /></>} /></Routes></HighlightProvider></StopSheetProvider></MemoryRouter>
    </QueryClientProvider>,
  )
  const row = day('2027-02-08').querySelector('[data-stop="s1"]') as HTMLElement
  await userEvent.hover(row)
  expect(screen.getByTestId('lit')).toHaveTextContent('s1')
  await userEvent.unhover(row)
  expect(screen.getByTestId('lit')).toHaveTextContent('')
  act(() => { (row.querySelector('.stop-main') as HTMLElement).focus() })
  expect(screen.getByTestId('lit')).toHaveTextContent('s1')
})

it('a walk being worked out shows a quiet pulsing leg', () => {
  db.walk.mockReturnValueOnce(new Promise(() => {}))
  const t = lap(); db.trips = [t]
  db.stops = [stop({ trip_id: t.id, title: 'a', day: '2027-02-08', time: '10:00', place: place({ lat: 66.50, lng: 25.70 }) }),
    stop({ trip_id: t.id, title: 'b', day: '2027-02-08', time: '11:00', place: place({ lat: 66.51, lng: 25.72 }) })]
  showAt('/trip/lap?day=2027-02-08')
  expect(day('2027-02-08').querySelector('.leg.pulse')).toHaveTextContent('directions')
})
