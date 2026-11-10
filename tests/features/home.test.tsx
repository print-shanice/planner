import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { trip, stop, place } from '../factories'
import type { Trip, Stop } from '../../src/lib/types'

const db = vi.hoisted(() => ({
  tripsQ: null as null | Record<string, unknown>,
  trips: [] as unknown[],
  stops: [] as unknown[],
  links: [] as unknown[],
  members: [] as unknown[],
  reviews: [] as unknown[],
  globe: null as null | { pins: { code: string }[]; routes?: [number, number][][]; focus?: { code: string; n: number } | null },
  save: vi.fn((r: unknown) => Promise.resolve(r)),
  remove: vi.fn(() => Promise.resolve()),
}))
vi.mock('../../src/lib/queries', () => ({
  useTrips: () => db.tripsQ ?? ({ data: db.trips, isLoading: false }),
  useStops: () => ({ data: db.stops, isLoading: false }),
  useLinks: () => ({ data: db.links }),
  useMembers: () => ({ data: db.members }),
  useReviews: () => ({ data: db.reviews }),
  useRates: () => ({ data: null }),
  useSave: () => ({ mutateAsync: db.save, mutate: db.save, isPending: false }),
  useRemove: () => ({ mutateAsync: db.remove, isPending: false }),
}))
const env = vi.hoisted(() => ({ online: true, signOut: vi.fn(), forget: vi.fn() }))
vi.mock('../../src/lib/offline', () => ({ useCanEdit: () => true, useOnline: () => env.online, forgetDevice: env.forget }))
const keyApi = vi.hoisted(() => ({ has: vi.fn(), make: vi.fn() }))
vi.mock('../../src/lib/saveKey', () => ({ hasSaveKey: keyApi.has, newSaveKey: keyApi.make }))
vi.mock('../../src/lib/auth', () => ({ useAuth: () => ({ status: 'signed-in', email: 'shanice@x.com', userId: 'u1', signOut: env.signOut }) }))
vi.mock('../../src/features/home/Globe', () => ({
  Globe: (p: { onCountry: (c: string) => void; pins: { code: string }[]; routes?: [number, number][][]; focus?: { code: string; n: number } | null }) => {
    db.globe = p
    return <button onClick={() => p.onCountry('FI')}>globe</button>
  },
}))

import { HomePage } from '../../src/features/home/HomePage'
import { TripForm } from '../../src/features/home/TripForm'

function Where() {
  const l = useLocation()
  return <output data-testid="loc">{l.pathname + l.search}</output>
}

function show(path = '/') {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/trip/:id" element={<><p>opened trip</p><Where /></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-05T10:00:00'))
  localStorage.clear()
  db.trips = []; db.stops = []; db.links = []; db.reviews = []; db.save.mockClear(); db.remove.mockClear()
  db.globe = null; env.online = true
  keyApi.has.mockReset().mockResolvedValue(false); keyApi.make.mockReset().mockResolvedValue('a1'.repeat(32))
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


it('home has one +, which adds a trip or saves a link', async () => {
  db.trips = europe()
  show()
  expect(screen.getAllByRole('button', { name: 'add' })).toHaveLength(1)
  await userEvent.click(screen.getByRole('button', { name: 'add' }))
  const menu = screen.getByRole('dialog', { name: 'add' })
  expect(within(menu).getAllByRole('button').map((b) => b.textContent).filter((t) => t !== '')).toEqual(['trip', 'link'])
})

it('totals count countries, cities and trips', () => {
  db.trips = europe()
  db.stops = [
    stop({ trip_id: 'lap', place: place({ name: 'arktikum', city: 'rovaniemi', country: 'FI' }) }),
    stop({ trip_id: 'par', place: place({ name: 'louvre', city: 'paris', country: 'FR' }) }),
  ] as Stop[]
  show('/?view=travels')
  const totals = screen.getByTestId('totals')
  expect(totals).toHaveTextContent(/2\s*countries/)
  expect(totals).toHaveTextContent(/2\s*cities/)
  expect(totals).toHaveTextContent(/4\s*trips/)
})

it('trip form saves dates and currency', async () => {
  show()
  await userEvent.click(screen.getByRole('button', { name: 'add' }))
  await userEvent.click(screen.getByRole('button', { name: 'trip' }))
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
  await userEvent.click(screen.getByRole('button', { name: 'add' }))
  await userEvent.click(screen.getByRole('button', { name: 'trip' }))
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
  show('/?view=travels')
  await userEvent.click(await screen.findByRole('button', { name: 'globe' }))
  const sheet = screen.getByRole('dialog', { name: /finland/i })
  expect(within(sheet).getByText('lapland')).toBeInTheDocument()
  expect(within(sheet).getByText('summer')).toBeInTheDocument()
})

it('choosing a country with one trip opens it', async () => {
  db.trips = europe()
  db.stops = [stop({ trip_id: 'lap', place: place({ country: 'FI' }) })] as Stop[]
  show('/?view=travels')
  await userEvent.click(await screen.findByRole('button', { name: 'globe' }))
  expect(screen.getByText('opened trip')).toBeInTheDocument()
})

it('a link in the inbox goes to a trip from its own row', async () => {
  db.trips = europe()
  db.links = [{ id: 'l1', trip_id: null, url: 'https://www.instagram.com/reel/Cx1/', title: 'cafe reel', note: '' }]
  show('/?view=inbox')
  await userEvent.click(screen.getByRole('button', { name: 'move cafe reel to a trip' }))
  const list = screen.getByRole('listbox', { name: 'move cafe reel to a trip' })
  expect(within(list).getAllByRole('option').map((o) => [o.textContent, o.getAttribute('data-depth')])).toEqual([
    ['europe exchange 2027', '0'], ['lapland', '1'], ['paris', '1'], ['summer', '0'],
  ])
  await userEvent.click(within(list).getByRole('option', { name: 'paris' }))
  expect(db.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'l1', trip_id: 'par' }))
})

it('"to a trip" lists what is coming first, then past trips newest first', async () => {
  db.trips = [trip({ id: 'b', name: 'bali', start_date: '2025-06-01', end_date: '2025-06-09' }), trip({ id: 'c', name: 'crete', start_date: '2026-05-01', end_date: '2026-05-04' }), ...europe()]
  db.links = [{ id: 'l1', trip_id: null, url: 'https://example.com/a', title: 'a', note: '' }]
  show('/?view=inbox')
  await userEvent.click(screen.getByRole('button', { name: 'move a to a trip' }))
  expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['europe exchange 2027', 'lapland', 'paris', 'summer', 'crete', 'bali'])
})

it('an inbox link is named by your note, with the site\'s own icon', () => {
  db.links = [{ id: 'l1', trip_id: null, url: 'https://www.instagram.com/reel/Cx1/', title: 'instagram', note: 'rooftop bar' }]
  show('/?view=inbox')
  const row = screen.getByRole('link', { name: /rooftop bar/ })
  expect(row).toHaveTextContent('instagram.com')
  expect(row).not.toHaveTextContent('instagram.com · rooftop bar')
  expect(row.querySelector('img.site-icon')).toHaveAttribute('src', 'https://www.google.com/s2/favicons?domain=instagram.com&sz=64')
})

it('a long swipe either way removes an inbox link, without opening it', () => {
  db.links = [
    { id: 'l1', trip_id: null, url: 'https://example.com/a', title: 'a', note: '' },
    { id: 'l2', trip_id: null, url: 'https://example.com/b', title: 'b', note: '' },
  ]
  db.remove.mockClear()
  show('/?view=inbox')
  for (const [id, to] of [['l1', 400], ['l2', 100]] as const) {
    const row = screen.getByRole('link', { name: id === 'l1' ? /^a/ : /^b/ }).closest('li') as HTMLElement
    fireEvent.pointerDown(row, { clientX: 250, pointerId: 1 })
    fireEvent.pointerMove(row, { clientX: to, pointerId: 1 })
    fireEvent.pointerUp(row, { clientX: to, pointerId: 1 })
    const opened = fireEvent.click(screen.getByRole('link', { name: id === 'l1' ? /^a/ : /^b/ }))
    expect(opened).toBe(false)
  }
  return waitFor(() => expect(db.remove.mock.calls.map((c) => (c as unknown[])[0])).toEqual(['l1', 'l2']))
})

it('a short swipe on an inbox link does nothing', () => {
  db.links = [{ id: 'l1', trip_id: null, url: 'https://example.com/a', title: 'a', note: '' }]
  db.remove.mockClear()
  show('/?view=inbox')
  const row = screen.getByRole('link', { name: /^a/ }).closest('li') as HTMLElement
  fireEvent.pointerDown(row, { clientX: 250, pointerId: 1 })
  fireEvent.pointerUp(row, { clientX: 290, pointerId: 1 })
  expect(db.remove).not.toHaveBeenCalled()
})

it('the globe gets a pin for each country with a located place', async () => {
  db.trips = europe()
  db.stops = [stop({ trip_id: 'lap', place: place({ country: 'FI', lat: 66.5, lng: 25.7 }) })] as Stop[]
  show('/?view=travels')
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

it('account makes a save key for the share sheet, shows it once and copies it', async () => {
  const write = vi.fn(() => Promise.resolve())
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true })
  show()
  await userEvent.click(screen.getByRole('button', { name: 'account' }))
  const sheet = screen.getByRole('dialog', { name: 'account' })
  expect(within(sheet).queryByText('share sheet')).toBeNull()
  await userEvent.click(await within(sheet).findByRole('button', { name: 'make a save key' }))
  expect(keyApi.make).toHaveBeenCalledTimes(1)
  expect(await within(sheet).findByText('a1'.repeat(32))).toHaveClass('keep-case')
  await userEvent.click(within(sheet).getByRole('button', { name: 'copy save key' }))
  expect(write).toHaveBeenCalledWith('a1'.repeat(32))
})

it('replacing a save key takes two taps', async () => {
  keyApi.has.mockResolvedValue(true)
  show()
  await userEvent.click(screen.getByRole('button', { name: 'account' }))
  const sheet = screen.getByRole('dialog', { name: 'account' })
  await userEvent.click(await within(sheet).findByRole('button', { name: 'new save key' }))
  expect(keyApi.make).not.toHaveBeenCalled()
  await userEvent.click(within(sheet).getByRole('button', { name: 'tap again · the old key stops working' }))
  expect(keyApi.make).toHaveBeenCalledTimes(1)
  expect(await within(sheet).findByText('a1'.repeat(32))).toBeInTheDocument()
})

it('a save key needs a connection, and a failed one says so', async () => {
  keyApi.make.mockRejectedValue(new Error('network'))
  show()
  await userEvent.click(screen.getByRole('button', { name: 'account' }))
  await userEvent.click(await screen.findByRole('button', { name: 'make a save key' }))
  expect(await screen.findByText("couldn't make a save key")).toHaveClass('warn-line')
})

it('sign out waits for a connection', async () => {
  env.online = false
  show()
  await userEvent.click(screen.getByRole('button', { name: 'account' }))
  expect(screen.getByRole('button', { name: 'sign out' })).toBeDisabled()
  expect(await screen.findByRole('button', { name: 'make a save key' })).toBeDisabled()
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
  expect(folds).toEqual([['budget, notes & trip details', 'false']])
  expect(screen.getByLabelText('home base')).toBeVisible()
  expect(screen.getByRole('radiogroup', { name: 'colour' })).toBeVisible()
  expect(screen.getByLabelText('notes')).not.toBeVisible()
})

it('a trip with a budget opens with "more" open', () => {
  render(<MemoryRouter><TripForm trip={trip({ id: 't9', budget: 900 }) as Trip} onDone={() => {}} /></MemoryRouter>)
  expect(screen.getByRole('button', { name: 'budget, notes & trip details' })).toHaveAttribute('aria-expanded', 'true')
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

describe('the totals say what they count', () => {
  beforeEach(() => {
    db.trips = europe()
    db.stops = [
      stop({ trip_id: 'lap', place: place({ name: 'arktikum', city: 'rovaniemi', country: 'FI' }) }),
      stop({ trip_id: 'par', place: place({ name: 'louvre', city: 'paris', country: 'FR' }) }),
    ] as Stop[]
  })
  const item = (label: string) => within(screen.getByTestId('totals')).getByText(label).closest('[tabindex]') as HTMLElement

  it('hovering a number shows the tooltip listing them', async () => {
    show('/?view=travels')
    await userEvent.hover(item('countries'))
    const tip = screen.getByRole('tooltip')
    expect(tip).toHaveClass('globe-tip')
    expect(tip).toHaveTextContent('2 countries')
    expect(tip).toHaveTextContent('finland · france')
    await userEvent.unhover(item('countries'))
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('cities and trips list theirs too', async () => {
    show('/?view=travels')
    await userEvent.hover(item('cities'))
    expect(screen.getByRole('tooltip')).toHaveTextContent('paris · rovaniemi')
    await userEvent.hover(item('trips'))
    expect(screen.getByRole('tooltip')).toHaveTextContent('europe exchange 2027 · lapland · paris · summer')
  })

  it('a tap or tab shows it too, and escape hides it', async () => {
    show('/?view=travels')
    await userEvent.click(item('cities'))
    expect(screen.getByRole('tooltip')).toHaveTextContent('2 cities')
    expect(item('cities')).toHaveAttribute('aria-describedby', screen.getByRole('tooltip').id)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})

it('a total\'s tooltip floats above the page, so showing it can never move the page', async () => {
  db.trips = europe()
  db.stops = [stop({ trip_id: 'lap', place: place({ name: 'arktikum', city: 'rovaniemi', country: 'FI' }) })] as Stop[]
  show('/?view=travels')
  const cities = within(screen.getByTestId('totals')).getByText('cities').closest('[tabindex]') as HTMLElement
  await userEvent.hover(cities)
  const tip = screen.getByRole('tooltip')
  expect(tip.style.position).toBe('fixed')
  expect(tip.parentElement).toBe(document.body)
})

const items = () => screen.getAllByTestId('trip-item')
const views = () => within(screen.getByRole('navigation', { name: 'home' })).getAllByRole('link')

describe('trips, the view home opens on', () => {
  it('leads with the next trip, then lists what is coming with side trips under their parent', () => {
    db.trips = europe()
    show()
    expect(views().map((v) => v.textContent)).toEqual(['trips', 'inbox', 'travels'])
    expect(views()[0]).toHaveAttribute('aria-current', 'page')
    const lead = screen.getByTestId('lead')
    expect(lead).toHaveTextContent('next · in 84 days')
    expect(lead).toHaveTextContent('europe exchange 2027')
    expect(lead).toHaveTextContent('28 jan – 13 jul · 166 nights')
    expect(within(lead).getByRole('link', { name: 'open the plan →' }).getAttribute('href')).toMatch(/^\/trip\/ex/)
    expect(screen.getByRole('heading', { level: 2, name: 'upcoming' })).toBeInTheDocument()
    // one card per trip, its side trips inside it
    const families = screen.getAllByTestId('trip-family')
    expect(families).toHaveLength(2)
    expect(items().map((r) => r.textContent)).toEqual([
      expect.stringMatching(/europe exchange 2027.*28 jan – 13 jul.*in 84 days.*2 side trips/),
      expect.stringMatching(/summer.*1 – 10 jun.*in 208 days/),
    ])
    const sides = within(families[0]).getAllByTestId('side-item')
    expect(sides.map((r) => r.textContent)).toEqual([
      expect.stringMatching(/lapland.*7 – 11 feb.*in 94 days/), expect.stringMatching(/paris.*5 – 8 mar.*in 120 days/),
    ])
    expect(sides[0]).toHaveAttribute('href', '/trip/lap')
    expect(within(families[1]).queryAllByTestId('side-item')).toHaveLength(0)
  })

  it('a trip shows all its side trips, however many; their own side trips are named', () => {
    const kids = ['a', 'b', 'c', 'd', 'e'].map((n, i) => trip({ id: n, parent_id: 'ex', name: `side ${n}`, start_date: `2027-02-0${i + 1}`, end_date: `2027-02-0${i + 1}` }))
    db.trips = [trip({ id: 'ex', name: 'europe exchange 2027', start_date: '2027-01-28', end_date: '2027-07-13' }), ...kids,
      trip({ id: 'mon', parent_id: 'a', name: 'montserrat', start_date: '2027-02-01', end_date: '2027-02-01' })]
    show()
    const family = screen.getByTestId('trip-family')
    expect(within(family).getAllByTestId('side-item').map((r) => r.querySelector('.side-name')!.textContent)).toEqual(['side a', 'side b', 'side c', 'side d', 'side e'])
    expect(within(family).getAllByTestId('side-item')[0]).toHaveTextContent('+ montserrat')
    expect(within(family).queryByRole('button', { name: /more side trips/ })).toBeNull()
  })

  it('has the month calendar under the banner, opening on the month the soonest trip starts', () => {
    db.trips = europe()
    show()
    const cal = screen.getByTestId('calendar')
    expect(screen.getByTestId('lead').compareDocumentPosition(cal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(cal.compareDocumentPosition(items()[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(cal).getByText('january')).toBeInTheDocument()
    expect(within(cal).getByText('2027')).toBeInTheDocument()
    expect(cal.querySelectorAll('[data-day]')).toHaveLength(31)
    expect(cal.querySelector('[data-day="2027-01-28"]')).toHaveAttribute('data-ribbon', 'start')
    expect(cal.querySelector('[data-day="2027-01-29"]')).toHaveAttribute('data-ribbon', 'on')
    expect(cal.querySelector('[data-day="2027-01-27"]')).not.toHaveAttribute('data-ribbon')
  })

  it('the calendar moves by month, and a side trip takes over its days from its parent', async () => {
    const user = userEvent.setup()
    db.trips = europe()
    show()
    await user.click(screen.getByRole('button', { name: 'next month' }))
    const cal = screen.getByTestId('calendar')
    expect(within(cal).getByText('february')).toBeInTheDocument()
    const day = (d: string) => cal.querySelector(`[data-day="${d}"]`) as HTMLElement
    expect(day('2027-02-06').style.getPropertyValue('--c')).toBe('var(--g0)')
    expect(day('2027-02-07')).toHaveAttribute('data-ribbon', 'start')
    expect(day('2027-02-07').style.getPropertyValue('--c')).toBe('var(--g1)')
    expect(day('2027-02-11')).toHaveAttribute('data-ribbon', 'end')
    expect(day('2027-02-12').style.getPropertyValue('--c')).toBe('var(--g0)')
    await user.click(screen.getByRole('button', { name: 'previous month' }))
    await user.click(screen.getByRole('button', { name: 'previous month' }))
    expect(within(screen.getByTestId('calendar')).getByText('december')).toBeInTheDocument()
  })

  it('a day in the calendar opens that day in the trip it belongs to (a side trip\'s own day in the side trip)', async () => {
    db.trips = europe()
    show()
    const cal = screen.getByTestId('calendar')
    expect(cal.querySelector('[data-day="2027-01-27"]')!.tagName).not.toBe('BUTTON')
    await userEvent.click(within(cal).getByRole('button', { name: /29 jan/ }))
    expect(screen.getByTestId('loc')).toHaveTextContent('/trip/ex?day=2027-01-29')
  })

  it('a side trip\'s day opens the side trip', async () => {
    db.trips = europe()
    show()
    await userEvent.click(screen.getByRole('button', { name: 'next month' }))
    await userEvent.click(within(screen.getByTestId('calendar')).getByRole('button', { name: /^mon 8 feb/ }))
    expect(screen.getByTestId('loc')).toHaveTextContent('/trip/lap?day=2027-02-08')
  })

  it('while a trip is on, the calendar opens on this month and rings today', () => {
    vi.setSystemTime(new Date('2027-02-09T10:00:00'))
    db.trips = [trip({ id: 'fin', name: 'finland', start_date: '2027-02-07', end_date: '2027-02-11' })]
    show()
    const cal = screen.getByTestId('calendar')
    expect(within(cal).getByText('february')).toBeInTheDocument()
    expect(cal.querySelector('[aria-current="date"]')).toHaveAttribute('data-day', '2027-02-09')
  })

  it('a trip that is on now leads, saying which day it is', () => {
    vi.setSystemTime(new Date('2027-02-08T10:00:00'))
    db.trips = europe()
    show()
    const lead = screen.getByTestId('lead')
    expect(lead).toHaveTextContent('now · day 12 of 167')
    expect(lead).toHaveTextContent('europe exchange 2027')
    expect(items()[0]).toHaveTextContent('now')
  })

  it('a trip without dates is listed last and never leads', () => {
    db.trips = [trip({ id: 'maybe', name: 'someday japan', start_date: null, end_date: null })]
    show()
    expect(screen.queryByTestId('lead')).toBeNull()
    expect(items().map((r) => r.textContent)).toEqual([expect.stringContaining('someday japan')])
  })

  it('no trips shows only the empty title, with the + to add one', () => {
    show()
    expect(screen.getByText('no trips yet')).toBeVisible()
    expect(screen.queryByTestId('calendar')).toBeNull()
    expect(screen.getByRole('button', { name: 'add' })).toBeInTheDocument()
    expect(screen.queryByTestId('lead')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'past' })).toBeNull()
  })

  it('past trips follow once one has ended, newest first', () => {
    db.trips = [trip({ id: 'b', name: 'bali', start_date: '2025-06-01', end_date: '2025-06-09' }), trip({ id: 'c', name: 'crete', start_date: '2026-05-01', end_date: '2026-05-04' })]
    show()
    expect(screen.getByText('nothing coming up')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'past' })).toBeInTheDocument()
    expect(items().map((r) => r.textContent)).toEqual([expect.stringContaining('crete'), expect.stringContaining('bali')])
  })

  it('shows neither the inbox nor the globe', () => {
    db.trips = europe()
    db.links = [{ id: 'l1', trip_id: null, url: 'https://example.com/a', title: 'a', note: '' }]
    show()
    expect(screen.queryByText('example.com')).toBeNull()
    expect(screen.queryByTestId('totals')).toBeNull()
    expect(db.globe).toBeNull()
  })
})

describe('the switch', () => {
  it('counts what waits in the inbox, and opens each view', async () => {
    db.trips = europe()
    db.links = [
      { id: 'l1', trip_id: null, url: 'https://example.com/a', title: 'a', note: '' },
      { id: 'l2', trip_id: 'ex', url: 'https://example.com/b', title: 'b', note: '' },
    ]
    show()
    expect(views().map((v) => v.textContent)).toEqual(['trips', 'inbox · 1', 'travels'])
    await userEvent.click(views()[1])
    expect(views()[1]).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /^a/ })).toBeInTheDocument()
    expect(screen.queryByTestId('lead')).toBeNull()
    await userEvent.click(views()[2])
    expect(screen.getByTestId('totals')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'globe' })).toBeInTheDocument()
  })

  it('an empty inbox says so in a few words', () => {
    show('/?view=inbox')
    expect(screen.getByText('inbox is empty')).toBeInTheDocument()
  })

  it('a link shared before signing in waits at the top of the inbox', () => {
    localStorage.setItem('planner-capture', JSON.stringify({ url: 'https://example.com/z', title: '', text: '' }))
    show('/?view=inbox')
    expect(screen.getByRole('link', { name: /not saved yet/ })).toHaveAttribute('href', '/save')
    expect(screen.queryByText('inbox is empty')).toBeNull()
  })

  it('travels holds the globe and its numbers, titled "life well lived"', () => {
    db.trips = europe()
    show('/?view=travels')
    const totals = screen.getByTestId('totals')
    const title = screen.getByText('life well lived')
    expect(totals).toHaveAttribute('aria-labelledby', title.id)
    expect(totals.closest('.travels-card')).not.toBeNull()
  })
})

describe('the inbox, a few at a time', () => {
  const three = () => [
    { id: 'l1', trip_id: null, url: 'https://example.com/a', title: 'a', note: '', created_at: '2026-11-03' },
    { id: 'l2', trip_id: null, url: 'https://example.com/b', title: 'b', note: '', created_at: '2026-11-02' },
    { id: 'l3', trip_id: null, url: 'https://example.com/c', title: 'c', note: '', created_at: '2026-11-01' },
  ]
  const pick = (name: string) => screen.getByRole('checkbox', { name: `select ${name}` })

  it('every row has a checkbox before its icon; the link and its own "to a trip" still work', async () => {
    db.trips = europe()
    db.links = three()
    show('/?view=inbox')
    expect(screen.queryByRole('button', { name: 'select' })).toBeNull()
    expect(screen.getAllByRole('checkbox', { name: /^select [abc]$/ })).toHaveLength(3)
    const row = pick('a').closest('li')!
    expect(pick('a').compareDocumentPosition(row.querySelector('.site-icon, .icon')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('link', { name: /^a/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'move a to a trip' })).toHaveTextContent('add to a trip')
    expect(screen.queryByRole('region', { name: 'selected links' })).toBeNull()
    await userEvent.click(pick('a'))
    await userEvent.click(pick('c'))
    expect(screen.getByRole('region', { name: 'selected links' })).toHaveTextContent('2 selected')
  })

  it('moves every picked link to one trip at once', async () => {
    db.trips = europe()
    db.links = three()
    db.save.mockClear()
    show('/?view=inbox')
    await userEvent.click(pick('a'))
    await userEvent.click(pick('b'))
    await userEvent.click(screen.getByRole('button', { name: 'move 2 links to a trip' }))
    await userEvent.click(screen.getByRole('option', { name: 'paris' }))
    expect(db.save.mock.calls.map((c) => c[0])).toEqual([{ id: 'l1', trip_id: 'par' }, { id: 'l2', trip_id: 'par' }])
    expect(pick('a')).not.toBeChecked()
    expect(screen.queryByRole('region', { name: 'selected links' })).toBeNull()
  })

  it('"select all" picks every link (then reads "deselect all"), and delete removes them together', async () => {
    db.links = three()
    db.remove.mockClear()
    show('/?view=inbox')
    expect(screen.queryByRole('checkbox', { name: 'select all' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'select all' }))
    expect(screen.getByRole('region', { name: 'selected links' })).toHaveTextContent('3 selected')
    await userEvent.click(screen.getByRole('button', { name: 'deselect all' }))
    expect(screen.queryByRole('region', { name: 'selected links' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'select all' }))
    await userEvent.click(screen.getByRole('button', { name: 'delete 3 links' }))
    await waitFor(() => expect(db.remove.mock.calls.map((c) => (c as unknown[])[0])).toEqual(['l1', 'l2', 'l3']))
  })

  it('the bar\'s ✕ lets go of the picks without changing anything', async () => {
    db.links = three()
    db.save.mockClear(); db.remove.mockClear()
    show('/?view=inbox')
    await userEvent.click(pick('b'))
    await userEvent.click(screen.getByRole('button', { name: 'clear selection' }))
    expect(pick('b')).not.toBeChecked()
    expect(screen.queryByRole('region', { name: 'selected links' })).toBeNull()
    expect(db.save).not.toHaveBeenCalled()
    expect(db.remove).not.toHaveBeenCalled()
  })
})

describe('moving between views', () => {
  it('the new view slides in from the side you moved towards, under an underline that slides along', async () => {
    db.trips = europe()
    show()
    const body = () => document.querySelector('.home-body') as HTMLElement
    expect(document.querySelector('.home-views-ink')).not.toBeNull()
    expect(body()).not.toHaveClass('from-right')
    expect(body()).not.toHaveClass('from-left')
    await userEvent.click(views()[2])
    expect(body()).toHaveClass('from-right')
    await userEvent.click(views()[1])
    expect(body()).toHaveClass('from-left')
    await userEvent.click(views()[2])
    expect(body()).toHaveClass('from-right')
  })
})

describe('travels, the scrapbook under the globe', () => {
  const ein = place({ name: 'eindhoven', city: 'eindhoven', country: 'NL', lat: 51.44, lng: 5.48 })
  const rvn = place({ name: 'rovaniemi', city: 'rovaniemi', country: 'FI', lat: 66.5, lng: 25.73 })
  const par = place({ name: 'paris nord', city: 'paris', country: 'FR', lat: 48.88, lng: 2.35 })
  function trips() {
    vi.setSystemTime(new Date('2027-03-01T10:00:00'))
    db.trips = europe().map((t) => (t.id === 'ex' ? { ...t, base: ein } : t))
    db.stops = [
      stop({ id: 'f1', trip_id: 'lap', kind: 'journey', mode: 'flight', day: '2027-02-07', origin: ein, destination: rvn }),
      stop({ id: 'f2', trip_id: 'lap', kind: 'journey', mode: 'flight', day: '2027-02-11', origin: rvn, destination: ein }),
      stop({ id: 'ark', trip_id: 'lap', title: 'arktikum', day: '2027-02-08', place: rvn }),
      stop({ id: 'tr', trip_id: 'par', kind: 'journey', mode: 'train', day: '2027-03-05', origin: ein, destination: par }),
    ] as Stop[]
    db.reviews = [{ id: 'r1', stop_id: 'ark', author_id: 'u1', rating: 5, return_choice: 'yes', outcome: 'done', comments: '' }]
  }

  it('getting around: the distance, and a ticket per kind of journey taken so far', () => {
    trips()
    show('/?view=travels')
    expect(screen.getByRole('heading', { level: 2, name: 'getting around' })).toBeInTheDocument()
    expect(screen.getByText(/\d,\d{3} km/)).toBeInTheDocument()
    expect(screen.getByText(/of the way round the world/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'flights · 2' })).toHaveAttribute('aria-expanded', 'false')
    // the train to paris hasn't happened yet
    expect(screen.queryByRole('button', { name: /^trains/ })).toBeNull()
  })

  it('opening a ticket lists its routes and draws them on the globe; closing it clears them', async () => {
    trips()
    show('/?view=travels')
    const flights = screen.getByRole('button', { name: 'flights · 2' })
    await userEvent.click(flights)
    expect(flights).toHaveAttribute('aria-expanded', 'true')
    const list = screen.getByRole('list', { name: 'flights' })
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringMatching(/eindhoven → rovaniemi.*7 feb/), expect.stringMatching(/rovaniemi → eindhoven.*11 feb/),
    ])
    await screen.findByRole('button', { name: 'globe' })
    expect(db.globe!.routes).toEqual([[[5.48, 51.44], [25.73, 66.5]], [[25.73, 66.5], [5.48, 51.44]]])
    await userEvent.click(flights)
    expect(db.globe!.routes).toEqual([])
  })

  it('passport: a stamp per country, dated the day you first arrived; tapping one turns the globe there', async () => {
    trips()
    show('/?view=travels')
    expect(screen.getByRole('heading', { level: 2, name: 'passport' })).toBeInTheDocument()
    const stamps = screen.getAllByRole('button', { name: /first stamped/ })
    expect(stamps.map((b) => b.getAttribute('aria-label'))).toEqual(['netherlands · first stamped 28 jan 2027', 'finland · first stamped 7 feb 2027'])
    await screen.findByRole('button', { name: 'globe' })
    await userEvent.click(stamps[1])
    expect(db.globe!.focus).toEqual(expect.objectContaining({ code: 'FI' }))
  })

  it('favourites: the places you loved, each opening its card', () => {
    trips()
    show('/?view=travels')
    expect(screen.getByRole('heading', { level: 2, name: 'favourites' })).toBeInTheDocument()
    const fav = screen.getByRole('link', { name: /arktikum/ })
    expect(fav).toHaveAttribute('href', '/trip/lap?day=2027-02-08&open=ark')
    expect(within(fav).getByLabelText('5 stars')).toBeInTheDocument()
    expect(fav).toHaveTextContent('would go back')
  })

  it('a section with nothing in it stays away', () => {
    db.trips = europe()
    show('/?view=travels')
    expect(screen.queryByRole('heading', { name: 'getting around' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'passport' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'favourites' })).toBeNull()
    expect(screen.getByTestId('totals')).toBeInTheDocument()
  })
})
