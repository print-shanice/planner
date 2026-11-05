import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { trip, stop, place } from '../factories'
import type { Stop, Trip } from '../../src/lib/types'

const db = vi.hoisted(() => ({
  trips: [] as unknown[],
  stops: [] as unknown[],
  save: vi.fn((r: unknown) => Promise.resolve(r)),
  walk: vi.fn(() => Promise.resolve(530)),
  search: vi.fn(),
}))
vi.mock('../../src/lib/queries', () => ({
  useTrips: () => ({ data: db.trips }),
  useStops: () => ({ data: db.stops }),
  useCosts: () => ({ data: [] }),
  useFiles: () => ({ data: [] }),
  useMembers: () => ({ data: [] }),
  useRates: () => ({ data: null }),
  useSave: () => ({ mutateAsync: db.save, mutate: db.save, isPending: false }),
  useRemove: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('../../src/lib/offline', () => ({ useCanEdit: () => true, useOnline: () => true }))
vi.mock('../../src/lib/walk', async (orig) => ({ ...(await orig<typeof import('../../src/lib/walk')>()), walkSeconds: db.walk }))
vi.mock('../../src/lib/photon', async (orig) => ({ ...(await orig<typeof import('../../src/lib/photon')>()), searchPlaces: db.search }))

import { PlanTab } from '../../src/features/plan/PlanTab'

const lap = () => trip({ id: 'lap', name: 'lapland', start_date: '2027-02-07', end_date: '2027-02-11', base: place({ name: 'rovaniemi', lat: 66.5, lng: 25.7 }) })

function show(t: Trip) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter><PlanTab trip={t} /></MemoryRouter>
    </QueryClientProvider>,
  )
}

const day = (date: string) => screen.getByTestId(`day-${date}`)

beforeEach(() => {
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

it('side trips show as a card on their first day', () => {
  const t = trip({ id: 'eu', name: 'europe', start_date: '2027-02-01', end_date: '2027-02-14' })
  const kid = trip({ id: 'lap', parent_id: 'eu', name: 'lapland', start_date: '2027-02-07', end_date: '2027-02-11' })
  db.trips = [t, kid]
  db.stops = []
  show(t)
  expect(within(day('2027-02-07')).getByRole('link', { name: /lapland/ })).toHaveAttribute('href', '/trip/lap')
})

it('long trips list only busy days and offer a date picker', () => {
  const t = trip({ id: 'eu', name: 'europe', start_date: '2027-01-28', end_date: '2027-07-13' })
  db.trips = [t]
  db.stops = [stop({ trip_id: 'eu', title: 'museum', day: '2027-03-02' })] as Stop[]
  show(t)
  expect(screen.getAllByTestId(/^day-/)).toHaveLength(1)
  expect(screen.getByLabelText('pick a date')).toBeInTheDocument()
})
