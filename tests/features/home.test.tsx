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

const legend = () => screen.getAllByTestId('cal-row').map((r) => r.textContent)

it('next up is a calendar that opens on the month the soonest trip starts', () => {
  db.trips = europe()
  show()
  expect(screen.getByRole('heading', { name: 'next up' })).toBeInTheDocument()
  const cal = screen.getByTestId('calendar')
  expect(within(cal).getByText('january')).toBeInTheDocument()
  expect(within(cal).getByText('2027')).toBeInTheDocument()
  expect(cal.querySelectorAll('[data-day]')).toHaveLength(31)
  expect(cal.querySelector('[data-day="2027-01-28"]')).toHaveAttribute('data-ribbon', 'start')
  expect(cal.querySelector('[data-day="2027-01-29"]')).toHaveAttribute('data-ribbon', 'on')
  expect(cal.querySelector('[data-day="2027-01-27"]')).not.toHaveAttribute('data-ribbon')
  // every upcoming trip stays listed, the ones on the calendar first
  expect(legend()).toEqual([
    expect.stringMatching(/europe exchange 2027.*28 jan – 13 jul · in 84 days/),
    expect.stringMatching(/summer.*1 – 10 jun · in 208 days/),
  ])
  expect(screen.getAllByTestId('cal-row')[0]).toHaveAttribute('href', '/trip/ex')
  expect(screen.queryByTestId('trip-card')).toBeNull()
})

it('the calendar moves by month, and a side trip takes over its days the way its parent shows', async () => {
  const user = userEvent.setup()
  db.trips = europe()
  show()
  await user.click(screen.getByRole('button', { name: 'next month' }))
  const cal = screen.getByTestId('calendar')
  expect(within(cal).getByText('february')).toBeInTheDocument()
  const day = (d: string) => cal.querySelector(`[data-day="${d}"]`) as HTMLElement
  expect(day('2027-02-06')).toHaveAttribute('data-ribbon', 'on')
  expect(day('2027-02-06').style.getPropertyValue('--c')).toBe('var(--g0)')
  // lapland's own days wear lapland's ribbon, first and last filled; no pills
  expect(day('2027-02-07')).toHaveAttribute('data-ribbon', 'start')
  expect(day('2027-02-07').style.getPropertyValue('--c')).toBe('var(--g1)')
  expect(day('2027-02-09')).toHaveAttribute('data-ribbon', 'on')
  expect(day('2027-02-11')).toHaveAttribute('data-ribbon', 'end')
  expect(day('2027-02-12')).toHaveAttribute('data-ribbon', 'on')
  expect(day('2027-02-12').style.getPropertyValue('--c')).toBe('var(--g0)')
  expect(within(cal).queryAllByTestId('cal-bar')).toHaveLength(0)
  expect(within(cal).queryByText('lapland')).toBeNull()
  expect(legend()).toEqual([
    expect.stringContaining('europe exchange 2027'),
    expect.stringMatching(/lapland.*7 – 11 feb/),
    expect.stringContaining('summer'),
  ])
  expect(screen.getAllByTestId('cal-row')[1]).toHaveAttribute('data-depth', '1')
  await user.click(screen.getByRole('button', { name: 'previous month' }))
  await user.click(screen.getByRole('button', { name: 'previous month' }))
  expect(within(screen.getByTestId('calendar')).getByText('december')).toBeInTheDocument()
  expect(within(screen.getByTestId('calendar')).getByText('2026')).toBeInTheDocument()
})

it('a trip that is on now opens on this month, rings today and says which day it is', () => {
  vi.setSystemTime(new Date('2027-02-09T10:00:00'))
  db.trips = [trip({ id: 'fin', name: 'finland', start_date: '2027-02-07', end_date: '2027-02-11' })]
  show()
  const cal = screen.getByTestId('calendar')
  expect(within(cal).getByText('february')).toBeInTheDocument()
  expect(cal.querySelector('[aria-current="date"]')).toHaveAttribute('data-day', '2027-02-09')
  expect(cal.querySelector('[data-day="2027-02-11"]')).toHaveAttribute('data-ribbon', 'end')
  expect(legend()).toEqual([expect.stringMatching(/finland.*7 – 11 feb · day 3/)])
  expect(document.querySelector('.pill.ok')).toBeNull()
})

it('an upcoming trip without dates is still listed', () => {
  db.trips = [...europe(), trip({ id: 'maybe', name: 'someday japan', start_date: null, end_date: null })]
  show()
  expect(legend().at(-1)).toContain('someday japan')
})

it('there is exactly one add-trip control on home', () => {
  db.trips = europe()
  show()
  expect(screen.getAllByRole('button', { name: 'new trip' })).toHaveLength(1)
})

it('no trips shows only the empty title', () => {
  show()
  expect(screen.getByText('no trips yet')).toBeVisible()
  expect(screen.queryByTestId('calendar')).toBeNull()
  expect(screen.queryByRole('heading', { name: 'past trips' })).toBeNull()
  expect(screen.queryByTestId('totals')).toBeNull()
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

it('the globe and its numbers share one card under "your travels, wrapped"', () => {
  db.trips = europe()
  show()
  const heading = screen.getByRole('heading', { level: 2, name: 'your travels, wrapped' })
  const totals = screen.getByTestId('totals')
  expect(totals.closest('.travels-card')).not.toBeNull()
  expect(totals).toHaveAttribute('aria-labelledby', heading.id)
  expect(screen.queryByText('life well lived')).toBeNull()
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
  const opts = within(screen.getByLabelText('part of')).getAllByRole('option', { hidden: true }).map((o) => o.textContent)
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

it('home has next up, your travels and past trips headings, nothing else', () => {
  db.trips = [trip({ name: 'bali', start_date: '2025-06-01', end_date: '2025-06-09' }), ...europe()]
  db.links = [{ id: 'l1', trip_id: null, url: 'https://www.instagram.com/reel/Cx1/', title: 'cafe reel', note: '' }]
  show()
  expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['next up', 'your travels, wrapped', 'past trips'])
  expect(screen.queryByText('cafe reel')).toBeNull()
})

it('when every trip is over, next up says so', () => {
  db.trips = [trip({ name: 'bali', start_date: '2025-06-01', end_date: '2025-06-09' })]
  show()
  expect(screen.getByText('nothing coming up')).toBeInTheDocument()
  expect(screen.queryByTestId('calendar')).toBeNull()
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

it('the trip form shows when, where and colour, and keeps budget and notes under "more"', () => {
  render(<MemoryRouter><TripForm onDone={() => {}} /></MemoryRouter>)
  const folds = [...document.querySelectorAll('.fold-toggle')].map((x) => [x.textContent, x.getAttribute('aria-expanded')])
  expect(folds).toEqual([['more', 'false']])
  expect(screen.getByLabelText('home base')).toBeVisible()
  expect(screen.getByRole('radiogroup', { name: 'colour' })).toBeVisible()
  expect(screen.getByLabelText('notes')).not.toBeVisible()
})

it('a trip with a budget opens with "more" open', () => {
  render(<MemoryRouter><TripForm trip={trip({ id: 't9', budget: 900 }) as Trip} onDone={() => {}} /></MemoryRouter>)
  expect(screen.getByRole('button', { name: 'more' })).toHaveAttribute('aria-expanded', 'true')
})

it('a failed trip save stays open with retry, and retry sends the same trip', async () => {
  db.save.mockRejectedValueOnce(new Error('asleep'))
  const done = vi.fn()
  render(<MemoryRouter><TripForm onDone={done} /></MemoryRouter>)
  await userEvent.type(screen.getByLabelText('name'), 'porto')
  await userEvent.click(screen.getByRole('button', { name: 'save' }))
  expect(await screen.findByText("couldn't save")).toBeInTheDocument()
  expect(done).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'retry' }))
  expect(done).toHaveBeenCalled()
  const [a, b] = db.save.mock.calls.map((c) => (c[0] as { id: string }).id)
  expect(a).toEqual(expect.any(String))
  expect(b).toBe(a)
})

it('a trip without a name asks for one', async () => {
  render(<MemoryRouter><TripForm onDone={() => {}} /></MemoryRouter>)
  await userEvent.click(screen.getByRole('button', { name: 'save' }))
  expect(screen.getByText('add a name')).toBeInTheDocument()
})

it('signing out says so while it happens', async () => {
  env.signOut.mockReturnValueOnce(new Promise(() => {}))
  show()
  await userEvent.click(screen.getByRole('button', { name: 'account' }))
  await userEvent.click(within(screen.getByRole('dialog', { name: 'account' })).getByRole('button', { name: 'sign out' }))
  expect(screen.getByRole('button', { name: /^signing out/ })).toHaveAttribute('aria-busy', 'true')
})

it('the globe sits under its own heading, like next up', () => {
  db.trips = europe()
  show()
  const heading = screen.getByRole('heading', { level: 2, name: 'your travels, wrapped' })
  const world = document.querySelector('.home-world') as HTMLElement
  expect(world.firstElementChild).toContainElement(heading)
})
