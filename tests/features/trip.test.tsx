import { render, screen, within } from '@testing-library/react'
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
  useSave: () => ({ mutateAsync: db.save, mutate: db.save, isPending: false }),
  useRemove: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('../../src/lib/offline', () => ({ useCanEdit: () => db.online, useOnline: () => db.online }))
vi.mock('../../src/features/map/MapTab', () => ({ MapTab: () => <p>map here</p> }))

import { TripPage } from '../../src/features/trip/TripPage'
import { readTab } from '../../src/features/trip/tabs'

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

it('phones show four sections in a bar at the bottom', () => {
  show('/trip/summer')
  const nav = screen.getByRole('navigation', { name: 'trip sections' })
  expect(nav).toHaveClass('tab-bar')
  expect(sections().getAllByRole('button').map((b) => b.textContent)).toEqual(['plan', 'map', 'money', 'saved'])
  expect(sections().getByRole('button', { name: 'plan' })).toHaveAttribute('aria-pressed', 'true')
})

it('laptops show plan, money and saved as a switch, with the map always beside', async () => {
  wide(true)
  show('/trip/summer')
  expect(screen.getByRole('navigation', { name: 'trip sections' })).toHaveClass('section-switch')
  expect(sections().getAllByRole('button').map((b) => b.textContent)).toEqual(['plan', 'money', 'saved'])
  expect(await screen.findByText('map here')).toBeInTheDocument()
})

it('old links land on the new sections', () => {
  const read = (q: string, w = false) => readTab(new URLSearchParams(q), w)
  expect(read('')).toEqual({ tab: 'plan', view: 'ideas' })
  for (const old of ['calendar', 'itinerary', 'plan']) expect(read(`tab=${old}`).tab).toBe('plan')
  for (const old of ['cost', 'money']) expect(read(`tab=${old}`).tab).toBe('money')
  expect(read('tab=ideas')).toEqual({ tab: 'saved', view: 'ideas' })
  expect(read('tab=links')).toEqual({ tab: 'saved', view: 'links' })
  expect(read('tab=packing')).toEqual({ tab: 'saved', view: 'packing' })
  expect(read('tab=saved')).toEqual({ tab: 'saved', view: 'ideas' })
  expect(read('tab=saved&view=links')).toEqual({ tab: 'saved', view: 'links' })
  expect(read('tab=saved&view=nope')).toEqual({ tab: 'saved', view: 'ideas' })
  expect(read('tab=map').tab).toBe('map')
  expect(read('tab=map', true).tab).toBe('plan')
  expect(read('tab=nope').tab).toBe('plan')
})

it('picking a section keeps the day you were on', async () => {
  show('/trip/summer?day=2027-06-28')
  await userEvent.click(sections().getByRole('button', { name: 'money' }))
  expect(loc().searchParams.get('tab')).toBe('money')
  expect(loc().searchParams.get('day')).toBe('2027-06-28')
  expect(screen.getByRole('heading', { level: 1, name: 'the long summer' })).toBeInTheDocument()
  await userEvent.click(sections().getByRole('button', { name: 'plan' }))
  expect(loc().searchParams.get('tab')).toBeNull()
  expect(loc().searchParams.get('day')).toBe('2027-06-28')
  expect(screen.getByTestId('day-2027-06-28')).toBeVisible()
})

it('saved switches between ideas, links and packing', async () => {
  show('/trip/summer?tab=saved')
  const views = within(screen.getByRole('group', { name: 'saved' }))
  expect(views.getAllByRole('button').map((b) => b.textContent)).toEqual(['ideas', 'links', 'packing'])
  expect(screen.getByRole('searchbox', { name: 'search ideas' })).toBeInTheDocument()
  await userEvent.click(views.getByRole('button', { name: 'links' }))
  expect(loc().searchParams.get('view')).toBe('links')
  expect(screen.getByRole('searchbox', { name: 'search links' })).toBeInTheDocument()
  await userEvent.click(views.getByRole('button', { name: 'packing' }))
  expect(loc().searchParams.get('view')).toBe('packing')
  expect(screen.getByRole('textbox', { name: 'add to pack' })).toBeInTheDocument()
  expect(views.getByRole('button', { name: 'packing' })).toHaveAttribute('aria-pressed', 'true')
})

for (const path of ['/trip/summer', '/trip/summer?day=2027-06-28', '/trip/summer?tab=money', '/trip/summer?tab=saved', '/trip/summer?tab=saved&view=links', '/trip/summer?tab=saved&view=packing', '/trip/summer?tab=map']) {
  it(`no section repeats its own name as a heading (${path})`, () => {
    show(path)
    for (const name of ['calendar', 'itinerary', 'plan', 'map', 'cost', 'money', 'saved', 'ideas', 'links', 'packing']) {
      expect(screen.queryByRole('heading', { level: 2, name })).toBeNull()
    }
  })
}

it('flags sit in the line under the title, which is only the name', () => {
  db.trips = [trip({ id: 'parent', name: 'exchange', base: place({ country: 'NL' }) }), trip({ id: 'lap', name: 'lapland', parent_id: 'parent', base: null, start_date: '2027-02-07', end_date: '2027-02-11' })]
  db.stops = [stop({ trip_id: 'lap', place: place({ country: 'FI' }) }), stop({ trip_id: 'lap', place: place({ country: 'fi' }) }), stop({ trip_id: 'lap', place: place({ country: 'SE' }) }), stop({ trip_id: 'lap', place: place({ country: 'FR' }), saved: true, day: null })]
  show('/trip/lap')
  const title = screen.getByRole('heading', { level: 1 })
  expect(title).toHaveTextContent(/^lapland$/)
  expect(within(title).queryAllByRole('img')).toHaveLength(0)
  const meta = screen.getByText(/7 – 11 feb/).closest('.trip-meta') as HTMLElement
  expect(within(meta).getAllByRole('img').map((f) => f.getAttribute('aria-label'))).toEqual(['Finland', 'Sweden'])
})

it('the line under the title shows up to four flags, then a count', () => {
  db.trips = [trip({ id: 'europe', name: 'europe exchange', base: place({ country: 'NL' }) })]
  db.stops = ['FI', 'SE', 'FR', 'ES', 'IT'].map(country => stop({ trip_id: 'europe', place: place({ country }) }))
  show('/trip/europe')
  const meta = document.querySelector('.trip-meta') as HTMLElement
  expect(within(meta).getAllByRole('img')).toHaveLength(4)
  expect(within(meta).getByText('+2')).toBeInTheDocument()
})

it('a long name stays whole in the heading', () => {
  db.trips = [trip({ id: 'long', name: 'a very long weekend around the northern lakes' })]
  show('/trip/long')
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('a very long weekend around the northern lakes')
  expect(screen.getByRole('heading', { level: 1 })).toHaveClass('one-line')
})

it('the people beside the back arrow open the trip settings', async () => {
  show('/trip/summer')
  const edit = screen.getByRole('button', { name: 'edit trip' })
  expect(edit.querySelectorAll('.avatar')).toHaveLength(1)
  await userEvent.click(edit)
  expect(screen.getByRole('dialog', { name: 'edit trip' })).toBeInTheDocument()
})

const header = () => within(document.querySelector('.trip-header') as HTMLElement)
const OPTIONS = ['place', 'stay', 'journey', 'note', 'cost', 'link', 'side trip']

for (const path of ['/trip/summer', '/trip/summer?tab=money', '/trip/summer?tab=saved&view=links', '/trip/summer?tab=saved&view=packing', '/trip/summer?tab=map']) {
  it(`one + on every section, and no other add buttons (${path})`, () => {
    show(path)
    expect(screen.getByRole('button', { name: 'add' })).toBeEnabled()
    expect(screen.getAllByRole('button', { name: 'add' })).toHaveLength(1)
    for (const name of ['add cost', 'add link', 'add idea', 'add note', 'add a place', 'stay', 'journey', 'side trip']) {
      expect(screen.queryByRole('button', { name })).toBeNull()
    }
  })
}

it('the + lists the seven things you can add, titled with the day you are on', async () => {
  show('/trip/summer?day=2027-06-28')
  await userEvent.click(header().getByRole('button', { name: 'add' }))
  const d = screen.getByRole('dialog', { name: 'add to mon 28 jun' })
  expect(within(d).getAllByRole('button').filter((b) => b.textContent).map((b) => b.textContent)).toEqual(OPTIONS)
})

it('away from the plan the + is just "add"', async () => {
  show('/trip/summer?tab=money')
  await userEvent.click(header().getByRole('button', { name: 'add' }))
  expect(screen.getByRole('dialog', { name: 'add' })).toBeInTheDocument()
})

for (const [option, form] of [['place', 'new place'], ['stay', 'new stay'], ['journey', 'new journey'], ['note', 'new note'], ['cost', 'new cost'], ['link', 'new link'], ['side trip', 'new side trip']]) {
  it(`"${option}" closes the menu and opens its form`, async () => {
    show('/trip/summer?day=2027-06-28')
    await userEvent.click(header().getByRole('button', { name: 'add' }))
    await userEvent.click(within(screen.getByRole('dialog', { name: 'add to mon 28 jun' })).getByRole('button', { name: option }))
    expect(screen.queryByRole('dialog', { name: 'add to mon 28 jun' })).toBeNull()
    expect(await screen.findByRole('dialog', { name: form })).toBeInTheDocument()
  })
}

it('a stay starts on the day you are on and runs to the end of the trip', async () => {
  show('/trip/summer?day=2027-06-28')
  await userEvent.click(header().getByRole('button', { name: 'add' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'stay' }))
  const d = await screen.findByRole('dialog', { name: 'new stay' })
  expect(within(d).getByLabelText('check-in')).toHaveValue('2027-06-28')
  expect(within(d).getByLabelText('check-out')).toHaveValue('2027-07-13')
})

it('a stay added without a day starts with the trip', async () => {
  show('/trip/summer?tab=money')
  await userEvent.click(header().getByRole('button', { name: 'add' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'stay' }))
  expect(within(await screen.findByRole('dialog', { name: 'new stay' })).getByLabelText('check-in')).toHaveValue('2027-06-26')
})

it('a place added on a day is set to that day', async () => {
  show('/trip/summer?day=2027-06-28')
  await userEvent.click(header().getByRole('button', { name: 'add' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'place' }))
  expect(within(await screen.findByRole('dialog', { name: 'new place' })).getByLabelText('day')).toHaveValue('2027-06-28')
})

async function addPlace(path: string) {
  db.save.mockClear()
  show(path)
  await userEvent.click(header().getByRole('button', { name: 'add' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'place' }))
  const d = await screen.findByRole('dialog', { name: 'new place' })
  await userEvent.type(within(d).getByRole('textbox', { name: /name/ }), 'kotisaari')
  await userEvent.click(screen.getByRole('button', { name: 'save' }))
  return db.save.mock.calls.at(-1)?.[0] as Record<string, unknown>
}

it('a place added from saved is an idea', async () => {
  expect(await addPlace('/trip/summer?tab=saved')).toEqual(expect.objectContaining({ kind: 'place', saved: true, day: null }))
})

it('a place added to a trip without dates waits under no date, not as an idea', async () => {
  db.trips = [trip({ id: 'someday', name: 'someday', start_date: null, end_date: null })] as Trip[]
  const row = await addPlace('/trip/someday')
  expect(row).toEqual(expect.objectContaining({ kind: 'place', day: null }))
  expect(row.saved).toBeFalsy()
  expect(screen.queryByRole('button', { name: 'add a place' })).toBeNull()
})

it('on a phone the map fills the screen: no header, a back chip and the + float over it', () => {
  show('/trip/summer?tab=map&day=2027-06-28')
  expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
  const float = within(document.querySelector('.map-float') as HTMLElement)
  expect(float.getByRole('link', { name: 'back to the long summer' })).toHaveAttribute('href', '/trip/summer?day=2027-06-28')
  expect(float.getByRole('link', { name: 'back to the long summer' })).toHaveTextContent('the long summer')
  expect(float.getByRole('button', { name: 'add' })).toBeEnabled()
  expect(screen.getByRole('navigation', { name: 'trip sections' })).toBeInTheDocument()
})

it('offline still says so on the phone map, where the header is hidden', () => {
  db.online = false
  show('/trip/summer?tab=map')
  db.online = true
  expect(within(document.querySelector('.map-float') as HTMLElement).getByText('offline')).toBeInTheDocument()
})
