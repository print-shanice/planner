import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { trip, stop, place } from '../factories'
import type { Trip } from '../../src/lib/types'

const db = vi.hoisted(() => ({ trips: [] as unknown[], stops: [] as unknown[], tripsQ: null as null | Record<string, unknown>, save: vi.fn((r: unknown) => Promise.resolve(r)), online: true }))
vi.mock('../../src/lib/queries', () => ({
  useTrips: () => db.tripsQ ?? ({ data: db.trips, isLoading: false }),
  useStops: () => ({ data: db.stops }),
  useCosts: () => ({ data: [] }),
  useLinks: () => ({ data: [] }),
  usePacking: () => ({ data: [] }),
  useFiles: () => ({ data: [] }),
  useMembers: () => ({ data: [{ email: 'shanice@x.com', user_id: 'u1', name: 'shanice', color: 0 }] }),
  useRates: () => ({ data: null }),
  useReviews: () => ({ data: [] }),
  useSave: () => ({ mutateAsync: db.save, mutate: db.save, isPending: false }),
  useRemove: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('../../src/lib/offline', () => ({ useCanEdit: () => db.online, useOnline: () => db.online }))
vi.mock('../../src/features/map/MapTab', () => ({ MapTab: () => <p>map here</p> }))

import { TripPage } from '../../src/features/trip/TripPage'
import { readTab, packingHome } from '../../src/features/trip/tabs'

function Probe() {
  const l = useLocation()
  return <output data-testid="loc">{l.pathname + l.search}</output>
}

function show(path: string) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<p>home</p>} />
          <Route path="/trip/:id" element={<><TripPage /><Probe /></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
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

it('unknown trip shows not found', () => {
  show('/trip/nope')
  expect(screen.getByText('trip not found')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'all trips' })).toHaveAttribute('href', '/')
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



const sections = () => within(screen.getByRole('navigation', { name: 'trip sections' }))
const loc = () => new URL('http://x' + screen.getByTestId('loc').textContent)

function wide(on: boolean) {
  window.matchMedia = ((q: string) => ({ matches: on && q.includes('1024'), media: q, addEventListener() {}, removeEventListener() {} })) as never
}
afterEach(() => wide(false))

it('phones show six sections in a bar at the bottom', () => {
  show('/trip/summer')
  const nav = screen.getByRole('navigation', { name: 'trip sections' })
  expect(nav).toHaveClass('tab-bar')
  expect(sections().getAllByRole('button').map((b) => b.textContent)).toEqual(['plan', 'map', 'places', 'notes', 'links', 'money'])
  expect(sections().getByRole('button', { name: 'plan' })).toHaveAttribute('aria-pressed', 'true')
})

it('laptops show one quiet row of five tabs, with the map always beside', async () => {
  wide(true)
  show('/trip/summer')
  expect(screen.getByRole('navigation', { name: 'trip sections' })).toHaveClass('section-tabs')
  expect(sections().getAllByRole('button').map((b) => b.textContent)).toEqual(['plan', 'places', 'notes', 'links', 'money'])
  expect(await screen.findByText('map here')).toBeInTheDocument()
  await userEvent.click(sections().getByRole('button', { name: 'money' }))
  expect(screen.getByText('map here')).toBeInTheDocument()
})

it('no section has a second layer of navigation inside it', async () => {
  for (const tab of ['', '?tab=places', '?tab=notes', '?tab=links', '?tab=money']) {
    const r = show(`/trip/summer${tab}`)
    expect(screen.queryByRole('group', { name: /saved|plan view|show/ })).toBeNull()
    expect(screen.getAllByRole('navigation').filter((n) => n.getAttribute('aria-label') !== 'days')).toHaveLength(1)
    r.unmount()
  }
})

it('packing lives on home now: an old packing link goes there, for this trip', async () => {
  for (const old of ['tab=packing', 'tab=more', 'tab=saved&view=packing']) {
    const r = show(`/trip/summer?${old}`)
    expect(await screen.findByText('home')).toBeInTheDocument()
    r.unmount()
  }
  expect(packingHome('summer')).toBe('/?view=packing&trip=summer')
})

it('old links land on the new sections', () => {
  const read = (q: string, w = false) => readTab(new URLSearchParams(q), w)
  expect(read('')).toBe('plan')
  for (const old of ['calendar', 'plan', 'itinerary', 'nope']) expect(read(`tab=${old}`)).toBe('plan')
  for (const old of ['cost', 'money']) expect(read(`tab=${old}`)).toBe('money')
  for (const old of ['ideas', 'saved', 'places']) expect(read(`tab=${old}`)).toBe('places')
  expect(read('tab=notes')).toBe('notes')
  expect(read('tab=links')).toBe('links')
  expect(read('tab=saved&view=links')).toBe('links')
  expect(read('tab=map')).toBe('map')
  // a laptop always has the map beside the plan
  expect(read('tab=map', true)).toBe('plan')
})

it('picking a section keeps the day you were reading', async () => {
  show('/trip/summer?day=2027-06-28')
  await userEvent.click(sections().getByRole('button', { name: 'money' }))
  await waitFor(() => expect(loc().searchParams.get('tab')).toBe('money'))
  expect(loc().searchParams.get('day')).toBe('2027-06-28')
  expect(screen.getByRole('heading', { level: 1, name: 'the long summer' })).toBeInTheDocument()
  await userEvent.click(sections().getByRole('button', { name: 'plan' }))
  await waitFor(() => expect(loc().searchParams.get('tab')).toBeNull())
  expect(loc().searchParams.get('day')).toBe('2027-06-28')
})

it('sections never repeat their own name as a heading', () => {
  show('/trip/summer?tab=money')
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('the long summer')
  expect(screen.queryByRole('heading', { level: 2, name: 'money' })).toBeNull()
})

it('the countries run as a route over the title, in the order you reach them, and the title is only the name', () => {
  db.trips = [trip({ id: 'parent', name: 'exchange', base: place({ country: 'NL' }) }), trip({ id: 'lap', name: 'lapland', parent_id: 'parent', base: null, start_date: '2027-02-07', end_date: '2027-02-11' })]
  db.stops = [stop({ trip_id: 'lap', day: '2027-02-10', place: place({ country: 'SE' }) }), stop({ trip_id: 'lap', day: '2027-02-07', place: place({ country: 'FI' }) }), stop({ trip_id: 'lap', day: '2027-02-08', place: place({ country: 'fi' }) }), stop({ trip_id: 'lap', place: place({ country: 'FR' }), saved: true, day: null })]
  show('/trip/lap')
  const title = screen.getByRole('heading', { level: 1 })
  expect(title).toHaveTextContent(/^lapland$/)
  const route = document.querySelector('.trip-route') as HTMLElement
  expect(route).toHaveAttribute('aria-label', 'countries: Finland, Sweden')
  expect([...route.querySelectorAll('abbr')].map((a) => a.textContent)).toEqual(['FI', 'SE'])
  expect(within(document.querySelector('.trip-meta') as HTMLElement).queryAllByRole('img')).toHaveLength(0)
})

it('a trip starts its route where it is based, and shows six countries, then a count', () => {
  db.trips = [trip({ id: 'europe', name: 'europe exchange', base: place({ country: 'NL' }) })]
  db.stops = ['FI', 'SE', 'FR', 'ES', 'IT', 'DE'].map((country, i) => stop({ trip_id: 'europe', day: `2027-03-0${i + 1}`, place: place({ country }) }))
  show('/trip/europe')
  const route = document.querySelector('.trip-route') as HTMLElement
  expect([...route.querySelectorAll('abbr')].map((a) => a.textContent)).toEqual(['NL', 'FI', 'SE', 'FR', 'ES', 'IT'])
  expect(within(route).getByText('+1')).toBeInTheDocument()
})

it('a long name stays whole in the heading', () => {
  db.trips = [trip({ id: 'long', name: 'a very long weekend around the northern lakes' })]
  show('/trip/long')
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('a very long weekend around the northern lakes')
  expect(screen.getByRole('heading', { level: 1 })).toHaveClass('one-line')
})

it('the people sharing the trip are the way into its settings', async () => {
  show('/trip/summer')
  const edit = screen.getByRole('button', { name: 'edit trip' })
  expect(edit.querySelectorAll('.avatar')).toHaveLength(1)
  await userEvent.click(edit)
  expect(screen.getByRole('dialog', { name: 'edit trip' })).toBeInTheDocument()
})

const OPTIONS = ['place', 'stay', 'journey', 'note', 'cost', 'link', 'side trip']

for (const path of ['/trip/summer', '/trip/summer?tab=money', '/trip/summer?tab=places', '/trip/summer?tab=notes', '/trip/summer?tab=links']) {
  it(`one + and no other add buttons (${path})`, () => {
    show(path)
    expect(screen.getAllByRole('button', { name: 'add' })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /add activity|add cost|save link|save place/ })).toBeNull()
  })
}

it('the + lists the seven kinds, titled with the day you are reading', async () => {
  show('/trip/summer?day=2027-06-28')
  await userEvent.click(screen.getByRole('button', { name: 'add' }))
  const d = screen.getByRole('dialog', { name: 'add to mon 28 jun' })
  expect(within(d).getAllByRole('button').filter((b) => b.textContent).map((b) => b.textContent)).toEqual(OPTIONS)
})

for (const [option, form] of [['place', 'new place'], ['stay', 'new stay'], ['journey', 'new journey'], ['note', 'new note'], ['cost', 'new cost'], ['link', 'save a link'], ['side trip', 'new side trip']]) {
  it(`"${option}" closes the menu and opens its form`, async () => {
    show('/trip/summer?day=2027-06-28')
    await userEvent.click(screen.getByRole('button', { name: 'add' }))
    await userEvent.click(within(screen.getByRole('dialog', { name: 'add to mon 28 jun' })).getByRole('button', { name: option }))
    expect(screen.queryByRole('dialog', { name: 'add to mon 28 jun' })).toBeNull()
    expect(await screen.findByRole('dialog', { name: form })).toBeInTheDocument()
  })
}

it('a stay starts on the day you are reading, with no check-out made up', async () => {
  show('/trip/summer?day=2027-06-28')
  await userEvent.click(screen.getByRole('button', { name: 'add' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'stay' }))
  const d = await screen.findByRole('dialog', { name: 'new stay' })
  expect(within(d).getByLabelText('check-in')).toHaveValue('2027-06-28')
  expect(within(d).getByLabelText('check-out')).toHaveValue('')
})

for (const tab of ['places', 'notes']) it(`from ${tab}, nothing gets a date it was not given`, async () => {
  show(`/trip/summer?tab=${tab}`)
  await userEvent.click(screen.getByRole('button', { name: 'add' }))
  await userEvent.click(within(screen.getByRole('dialog', { name: 'add' })).getByRole('button', { name: 'stay' }))
  expect(within(await screen.findByRole('dialog', { name: 'new stay' })).getByLabelText('check-in')).toHaveValue('')
})

it('a place added on a day is set to that day', async () => {
  show('/trip/summer?day=2027-06-28')
  await userEvent.click(screen.getByRole('button', { name: 'add' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'place' }))
  expect(within(await screen.findByRole('dialog', { name: 'new place' })).getByLabelText('day')).toHaveValue('2027-06-28')
})

it('with no day in the link, the + adds to the day the plan opens on', async () => {
  show('/trip/summer')
  await userEvent.click(screen.getByRole('button', { name: 'add' }))
  const menu = screen.getByRole('dialog', { name: 'add to sat 26 jun' })
  await userEvent.click(within(menu).getByRole('button', { name: 'place' }))
  expect(within(await screen.findByRole('dialog', { name: 'new place' })).getByLabelText('day')).toHaveValue('2027-06-26')
})

it('after adding, the plan moves to the day the new stop is on', async () => {
  show('/trip/summer?day=2027-06-28')
  await userEvent.click(screen.getByRole('button', { name: 'add' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'place' }))
  const d = await screen.findByRole('dialog', { name: 'new place' })
  await userEvent.type(within(d).getByRole('textbox', { name: /name/ }), 'kotisaari')
  await userEvent.click(within(d).getByRole('button', { name: /choose day/ }))
  await userEvent.click(within(screen.getByRole('dialog', { name: 'day' })).getByRole('button', { name: 'wed 30 jun' }))
  await userEvent.click(screen.getByRole('button', { name: 'save' }))
  expect(db.save).toHaveBeenLastCalledWith(expect.objectContaining({ day: '2027-06-30', title: 'kotisaari' }))
  expect(loc().searchParams.get('day')).toBe('2027-06-30')
})

async function addPlace(path: string) {
  db.save.mockClear()
  show(path)
  await userEvent.click(screen.getByRole('button', { name: 'add' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'place' }))
  const d = await screen.findByRole('dialog', { name: 'new place' })
  await userEvent.type(within(d).getByRole('textbox', { name: /name/ }), 'kotisaari')
  await userEvent.click(screen.getByRole('button', { name: 'save' }))
  return db.save.mock.calls.at(-1)?.[0] as Record<string, unknown>
}

it('a place added from places has no day', async () => {
  expect(await addPlace('/trip/summer?tab=places')).toEqual(expect.objectContaining({ kind: 'place', day: null }))
})

it('a place added to a trip without dates has no day', async () => {
  db.trips = [trip({ id: 'someday', name: 'someday', start_date: null, end_date: null })] as Trip[]
  const row = await addPlace('/trip/someday')
  expect(row).toEqual(expect.objectContaining({ kind: 'place', day: null }))
})

it('on a phone the map fills the screen: no header, a back chip and the + float over it', () => {
  show('/trip/summer?tab=map&day=2027-06-28')
  expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
  const float = within(document.querySelector('.map-float') as HTMLElement)
  expect(float.getByRole('link', { name: 'back to the long summer' })).toHaveAttribute('href', '/trip/summer?day=2027-06-28')
  expect(float.getByRole('link', { name: 'back to the long summer' })).toHaveTextContent('the long summer')
  expect(float.getByRole('button', { name: 'add' })).toBeInTheDocument()
  expect(screen.getByRole('navigation', { name: 'trip sections' })).toBeInTheDocument()
})

it('offline still says so on the phone map, where the header is hidden', () => {
  db.online = false
  show('/trip/summer?tab=map')
  db.online = true
  expect(within(document.querySelector('.map-float') as HTMLElement).getByText('offline')).toBeInTheDocument()
})

it('the map says it is loading while its code arrives', async () => {
  // a fresh copy of the page, so the map's code hasn't been loaded by an earlier test
  vi.resetModules()
  const { TripPage: Fresh } = await import('../../src/features/trip/TripPage')
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { enabled: false } } })}>
      <MemoryRouter initialEntries={['/trip/summer?tab=map']}><Routes><Route path="/trip/:id" element={<Fresh />} /></Routes></MemoryRouter>
    </QueryClientProvider>,
  )
  expect(screen.getByRole('status', { name: 'loading map' })).toBeInTheDocument()
  expect(await screen.findByText('map here')).toBeInTheDocument()
})

it('a tapped tab lights up at once, before the page has caught up', async () => {
  const { TripSummary } = await import('../../src/features/trip/TripSummary')
  const onPick = vi.fn()
  render(<TripSummary bar active="plan" onPick={onPick} tabs={['plan', 'map', 'places', 'notes', 'links', 'money']} />)
  fireEvent.click(screen.getByRole('button', { name: 'money' }))
  // lit straight away, before the section has even started to change
  expect(screen.getByRole('button', { name: 'money' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'plan' })).toHaveAttribute('aria-pressed', 'false')
  expect(onPick).not.toHaveBeenCalled()
  await waitFor(() => expect(onPick).toHaveBeenCalledWith('money'))
})

it('on a parent trip, adding to a side trip\'s day goes to that side trip', async () => {
  show('/trip/eu2027?day=2027-06-28')
  await userEvent.click(screen.getByRole('button', { name: 'add' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'place' }))
  const form = await screen.findByRole('dialog', { name: 'new place' })
  await userEvent.type(within(form).getByRole('textbox', { name: /name/ }), 'Lunch')
  await userEvent.click(within(form).getByRole('button', { name: 'save' }))
  expect(db.save).toHaveBeenLastCalledWith(expect.objectContaining({ trip_id: 'summer', day: '2027-06-28' }))
})

it('a map pin in the link survives section switches and the phone back link', async () => {
  db.stops = [stop({ id: 'selected', trip_id: 'summer', day: '2027-06-28', title: 'Museum' })]
  show('/trip/summer?tab=map&day=2027-06-28&pin=selected')
  expect(screen.getByRole('link', { name: 'back to the long summer' })).toHaveAttribute('href', '/trip/summer?day=2027-06-28&pin=selected')
  await userEvent.click(sections().getByRole('button', { name: 'money' }))
  await userEvent.click(sections().getByRole('button', { name: 'map' }))
  expect(loc().searchParams.get('pin')).toBe('selected')
  expect(loc().searchParams.get('day')).toBe('2027-06-28')
})

it('the plan\'s search sits in the header beside the +, and only on the plan', async () => {
  show('/trip/summer')
  const actions = document.querySelector('.trip-actions') as HTMLElement
  expect(within(actions).getByRole('button', { name: 'search the plan' })).toBeInTheDocument()
  expect(within(actions).getByRole('button', { name: 'add' })).toBeInTheDocument()
  expect(document.querySelector('.doc-strip-row')!.querySelector('[aria-label="search the plan"]')).toBeNull()
  await userEvent.click(within(actions).getByRole('button', { name: 'search the plan' }))
  expect(screen.getByRole('searchbox', { name: 'search the plan' })).toBeInTheDocument()
  expect(screen.queryByRole('navigation', { name: 'days' })).toBeNull()
})

it('other sections have no search button in the header', () => {
  show('/trip/summer?tab=money')
  expect(screen.queryByRole('button', { name: 'search the plan' })).toBeNull()
})

it('?open= opens that place\'s card, then leaves the address clean', async () => {
  db.stops = [stop({ id: 'ark', trip_id: 'eu2027', title: 'arktikum', day: '2027-02-08', place: place({ name: 'arktikum', city: 'rovaniemi', country: 'FI' }) })]
  show('/trip/eu2027?day=2027-02-08&open=ark')
  expect(await screen.findByRole('dialog', { name: /arktikum/ })).toBeInTheDocument()
  await waitFor(() => expect(screen.getByTestId('loc').textContent).not.toContain('open='))
})

it('on a laptop the line between plan and map can be dragged or moved with the arrow keys, and the width is remembered', async () => {
  localStorage.clear()
  wide(true)
  Object.defineProperty(window, 'innerWidth', { value: 1440, configurable: true })
  const first = show('/trip/summer')
  const handle = screen.getByRole('separator', { name: 'resize plan and map' })
  const page = document.querySelector('.trip') as HTMLElement
  expect(page.style.getPropertyValue('--plan-w')).toBe('')
  handle.focus()
  await userEvent.keyboard('{ArrowRight}')
  expect(page.style.getPropertyValue('--plan-w')).toBe('624px')
  expect(handle).toHaveAttribute('aria-valuenow', '624')
  await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')
  expect(page.style.getPropertyValue('--plan-w')).toBe('576px')
  first.unmount()
  show('/trip/summer')
  expect((document.querySelector('.trip') as HTMLElement).style.getPropertyValue('--plan-w')).toBe('576px')
  fireEvent.doubleClick(screen.getByRole('separator', { name: 'resize plan and map' }))
  expect((document.querySelector('.trip') as HTMLElement).style.getPropertyValue('--plan-w')).toBe('')
  expect(localStorage.getItem('planner.split')).toBeNull()
})

it('a phone has no line to drag', () => {
  wide(false)
  show('/trip/summer')
  expect(screen.queryByRole('separator')).toBeNull()
})
