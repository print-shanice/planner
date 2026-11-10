import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, useLocation } from 'react-router-dom'
import { trip, stop, place } from '../factories'

const db = vi.hoisted(() => ({ search: vi.fn(), trips: [] as any[], stops: [] as any[], save: vi.fn(), reverse: vi.fn(), stopsQ: null as null | Record<string, unknown>, highlight: undefined as unknown, fits: [] as Array<[string | undefined, number | undefined]>, overviews: [] as unknown[] }))
vi.mock('../../src/lib/queries', () => ({
  useTrips: () => ({ data: db.trips }),
  useLinks: () => ({ data: [] }),
  useStops: () => db.stopsQ ?? ({ data: db.stops }),
  useSave: () => ({ mutateAsync: db.save, mutate: db.save, isPending: false }),
}))
vi.mock('../../src/lib/offline', () => ({ useCanEdit: () => true, useOnline: () => true }))
vi.mock('../../src/lib/photon', async (orig) => ({ ...(await orig<typeof import('../../src/lib/photon')>()), reversePlace: db.reverse, searchPlaces: db.search }))
vi.mock('../../src/features/map/TripMap', () => ({
  TripMap: ({ onPick, onEmpty, onCenter, highlight, inset, fitKey, overview, onTrip }: { onTrip?: (id: string) => void; overview?: { sides: unknown[] } | null; fitKey?: string; onCenter?: (v: { lat: number; lng: number; zoom: number }) => void; onPick: (id: string) => void; onEmpty: (p: { lng: number; lat: number }) => void; highlight?: string | null; inset?: { top: number; bottom: number } }) => (
    // every render's view and inset, in order: the real map fits on the first render of a new view
    db.fits.push([fitKey, inset?.bottom]), db.overviews.push(overview),
    <div data-highlight={highlight ?? ''} data-inset={inset ? `${inset.top},${inset.bottom}` : ''} data-fit={fitKey} data-overview={overview ? overview.sides.length : ''}>
      <button onClick={() => onEmpty({ lng: 25.7287, lat: 66.5079 })}>tap map</button>
      <button onClick={() => onPick('s1')}>tap pin</button>
      <button onClick={() => onTrip?.('lap')}>tap side trip</button>
      <button onClick={() => onPick('cafe')}>tap idea</button>
      <button onClick={() => onCenter?.({ lat: 48.85, lng: 2.35, zoom: 12 })}>move map to paris</button>
    </div>
  ),
}))

import { MapTab } from '../../src/features/map/MapTab'
import { ReadingDayProvider, useReadingDay } from '../../src/features/trip/readingDay'

const lap = trip({ id: 'lap', name: 'lapland', start_date: '2027-02-07', end_date: '2027-02-11' })

beforeEach(() => {
  db.trips = [lap]
  db.stops = [
    stop({ id: 's1', trip_id: 'lap', title: 'arktikum', day: '2027-02-08', position: 0, place: place({ name: 'Arktikum', lat: 66.5, lng: 25.7 }) }),
    stop({ id: 's2', trip_id: 'lap', title: 'church', day: '2027-02-08', position: 4, place: place({ lat: 66.5, lng: 25.71 }) }),
  ]
  db.save.mockReset().mockResolvedValue({})
  db.reverse.mockReset()
  db.fits = []
  db.overviews = []
})

const show = (path = '/', phone = false) => render(<MemoryRouter initialEntries={[path]}><MapTab trip={lap} phone={phone} /></MemoryRouter>)

it('adding from a place card inserts at the end of the chosen day', async () => {
  db.reverse.mockResolvedValue({ name: 'Rovaniemi Church', address: 'Yliopistonkatu 2', lat: 66.5079, lng: 25.7287 })
  show()
  await userEvent.click(screen.getByRole('button', { name: 'tap map' }))
  const card = await screen.findByRole('region', { name: 'Rovaniemi Church' })
  await userEvent.selectOptions(within(card).getByLabelText('day'), '2027-02-08')
  await userEvent.click(within(card).getByRole('button', { name: 'add' }))
  expect(db.save).toHaveBeenCalledWith(expect.objectContaining({
    trip_id: 'lap', kind: 'place', title: 'Rovaniemi Church', day: '2027-02-08', position: 5,
    place: expect.objectContaining({ lat: 66.5079, lng: 25.7287 }),
  }))
})

it('an empty tap with nothing there is a dropped pin', async () => {
  db.reverse.mockResolvedValue(null)
  show()
  await userEvent.click(screen.getByRole('button', { name: 'tap map' }))
  expect(await screen.findByRole('region', { name: 'dropped pin' })).toBeInTheDocument()
})

it('saving keeps the place without a day', async () => {
  db.reverse.mockResolvedValue({ name: 'Rovaniemi Church', lat: 66.5079, lng: 25.7287 })
  show()
  await userEvent.click(screen.getByRole('button', { name: 'tap map' }))
  const card = await screen.findByRole('region', { name: 'Rovaniemi Church' })
  await userEvent.selectOptions(within(card).getByLabelText('day'), '')
  await userEvent.click(within(card).getByRole('button', { name: 'save idea' }))
  expect(db.save).toHaveBeenCalledWith(expect.objectContaining({ kind: 'place', saved: true, day: null, title: 'Rovaniemi Church' }))
})

it('a found place keeps the kind the search saw, on the stop and not inside the place', async () => {
  db.reverse.mockResolvedValue({ name: 'Kahvila', lat: 66.5079, lng: 25.7287, category: 'cafe' })
  show()
  await userEvent.click(screen.getByRole('button', { name: 'tap map' }))
  const card = await screen.findByRole('region', { name: 'Kahvila' })
  await userEvent.selectOptions(within(card).getByLabelText('day'), '')
  await userEvent.click(within(card).getByRole('button', { name: 'save idea' }))
  const row = db.save.mock.calls.at(-1)![0]
  expect(row.category).toBe('cafe')
  expect(row.place).not.toHaveProperty('category')
})

it('a pin opens its card with one primary action', async () => {
  show()
  await userEvent.click(screen.getByRole('button', { name: 'tap pin' }))
  const card = screen.getByRole('region', { name: 'arktikum' })
  expect(card.querySelectorAll('.btn.primary')).toHaveLength(1)
  expect(within(card).getByRole('link', { name: 'google maps →' })).toBeInTheDocument()
})

it('on a phone, filter chips list all days, each busy day and saved', () => {
  show('/', true)
  const scope = screen.getByRole('combobox', { name: 'map scope' })
  expect(within(scope).getAllByRole('option').map(o => (o as HTMLOptionElement).value)).toEqual(['all', '2027-02-08', 'saved'])
})

const loading = { data: undefined, status: 'pending', fetchStatus: 'fetching' }

beforeEach(() => { db.stopsQ = null })

it('the map says it is loading places', () => {
  db.stopsQ = loading
  show()
  expect(screen.getByRole('status', { name: 'loading' })).toBeInTheDocument()
})

describe('the places sheet on a phone', () => {
  const sheet = () => screen.getByRole('region', { name: 'places' })

  it('lists the chosen day\'s numbered places in order, under the day and a count', () => {
    show('/?day=2027-02-08', true)
    fireEvent.click(screen.getByRole('button', { name: 'places list' }))
    expect(within(sheet()).getByText('monday 8 · 2 places')).toBeInTheDocument()
    expect(within(sheet()).getAllByRole('button', { name: /arktikum|church/ }).map((b) => b.textContent)).toEqual([expect.stringMatching(/^1arktikum/), expect.stringMatching(/^2church/)])
  })

  it('opens and closes from its handle', async () => {
    show('/?day=2027-02-08', true)
    const handle = within(sheet()).getByRole('button', { name: 'places list' })
    expect(handle).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(handle)
    expect(handle).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(handle)
    expect(handle).toHaveAttribute('aria-expanded', 'false')
    expect(within(sheet()).queryByRole('button', { name: /arktikum/ })).toBeNull()
  })

  it('tapping a row opens that place\'s card', async () => {
    show('/?day=2027-02-08', true)
    fireEvent.click(screen.getByRole('button', { name: 'places list' }))
    await userEvent.click(within(sheet()).getByRole('button', { name: /arktikum/ }))
    expect(screen.getByRole('region', { name: 'arktikum' })).toBeInTheDocument()
  })

  it('all days counts every place', () => {
    show('/', true)
    expect(within(sheet()).getByText('2 places')).toBeInTheDocument()
  })

  it('laptops have no sheet; the plan beside is the list', () => {
    show('/?day=2027-02-08')
    expect(screen.queryByRole('region', { name: 'places' })).toBeNull()
  })
})

it('a link with a pin opens that place\'s card', () => {
  show('/?day=2027-02-08&pin=s1', true)
  expect(screen.getByRole('region', { name: 'arktikum' })).toBeInTheDocument()
})

describe('on a laptop, plan and map light each other up', () => {
  it('the stop hovered in the plan is the pin lit on the map', async () => {
    const { HighlightProvider, useHighlight } = await import('../../src/features/trip/highlight')
    function Hover() { const h = useHighlight(); return <button onClick={() => h.set('s1')}>hover arktikum</button> }
    render(<MemoryRouter><HighlightProvider><Hover /><MapTab trip={lap} /></HighlightProvider></MemoryRouter>)
    expect(document.querySelector('[data-highlight]')).toHaveAttribute('data-highlight', '')
    await userEvent.click(screen.getByRole('button', { name: 'hover arktikum' }))
    expect(document.querySelector('[data-highlight]')).toHaveAttribute('data-highlight', 's1')
  })

  it('clicking a pin finds its line in the plan beside', async () => {
    const main = document.createElement('section')
    main.className = 'trip-main'
    const row = document.createElement('div')
    row.dataset.line = 's1'
    row.innerHTML = '<button class="itin-main">arktikum row</button>'
    main.appendChild(row)
    document.body.appendChild(main)
    const scroll = vi.fn(); (row as any).scrollIntoView = scroll
    show()
    await userEvent.click(screen.getByRole('button', { name: 'tap pin' }))
    expect(scroll).toHaveBeenCalled()
    expect(document.activeElement).toBe(row.querySelector('button'))
    main.remove()
  })
})

it('on a phone the map fits the day inside what the floating bar, chips and sheet leave visible', () => {
  show('/?day=2027-02-08', true)
  const [top, bottom] = (document.querySelector('[data-inset]') as HTMLElement).dataset.inset!.split(',').map(Number)
  expect(top).toBeGreaterThanOrEqual(190)
  expect(bottom).toBeGreaterThanOrEqual(160)
  expect(bottom).toBeLessThan(280)
})

it('on a phone a places sheet taller than the usual margin pushes the fit up above it, as far as the sheet can grow', () => {
  db.stops = Array.from({ length: 8 }, (_, i) => stop({ id: `p${i}`, trip_id: 'lap', title: `p${i}`, day: '2027-02-08', position: i, place: place({ lat: 66.5 + i * 0.01, lng: 25.7 }) }))
  show('/?day=2027-02-08', true)
    fireEvent.click(screen.getByRole('button', { name: 'places list' }))
  const [, bottom] = (document.querySelector('[data-inset]') as HTMLElement).dataset.inset!.split(',').map(Number)
  expect(bottom).toBeGreaterThan(300)
  // the sheet stops at 45% of the screen (map.css), then scrolls
  expect(bottom).toBeLessThanOrEqual(Math.round(window.innerHeight * 0.45) + 68)
})

it('on a phone a new view is fitted with its own sheet height, not the last view\'s', async () => {
  // the sheet as tall as its rows, measured only once it has drawn
  const h = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) { return this.classList.contains('places-sheet') ? 68 + 57 * this.querySelectorAll('li').length : 0 })
  try {
    const parent = trip({ id: 'ex', name: 'exchange', start_date: '2027-01-28', end_date: '2027-07-13', base: place({ name: 'room', city: 'eindhoven', lat: 51.44, lng: 5.47 }) })
    const months = ['02', '03', '04', '05', '06']
    db.trips = [parent, ...months.map((m, i) => trip({ id: `side${i}`, name: `side ${i}`, parent_id: 'ex', start_date: `2027-${m}-10`, end_date: `2027-${m}-12`, base: place({ lat: 48 + i, lng: 10 + i }) }))]
    db.stops = [stop({ id: 'one', trip_id: 'ex', title: 'one', day: '2027-02-01', place: place({ lat: 51.44, lng: 5.48 }) })]
    render(<MemoryRouter initialEntries={['/trip/ex?tab=map&day=2027-02-01']}><MapTab trip={parent} phone /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'places list' }))
    const dayBottom = db.fits.filter(([k]) => k === 'ex|2027-02-01').at(-1)![1]!
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'map scope' }), 'all')
    const whole = db.fits.filter(([k]) => k === 'ex|all')
    expect(whole[0][1]).toBeGreaterThan(dayBottom)
    expect(whole[0][1]).toBe(whole.at(-1)![1])
  } finally { h.mockRestore() }
})

it('on a laptop the map keeps its usual margins', () => {
  show('/?day=2027-02-08')
  expect((document.querySelector('[data-inset]') as HTMLElement).dataset.inset).toBe('')
})

describe('on a laptop the map follows the plan', () => {
  const fit = () => (document.querySelector('[data-fit]') as HTMLElement).dataset.fit

  it('has no day chips', () => {
    show('/?day=2027-02-08')
    expect(screen.queryByRole('group', { name: 'show' })).toBeNull()
  })

  it('shows the day picked in the plan, or the plan\'s own first day', () => {
    show('/?day=2027-02-08')
    expect(fit()).toBe('lap|2027-02-08')
  })

  it('without a day in the link, it shows the same day the plan opens on', () => {
    show('/')
    expect(fit()).toBe('lap|2027-02-07')
  })

  it('"whole trip" zooms out to every place, and back', async () => {
    show('/?day=2027-02-08')
    const whole = screen.getByRole('button', { name: 'whole trip' })
    expect(whole).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(whole)
    expect(fit()).toBe('lap|all')
    expect(whole).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(whole)
    expect(fit()).toBe('lap|2027-02-08')
  })

  it('picking another day in the plan comes back from the whole trip to that day', async () => {
    render(<MemoryRouter initialEntries={['/?day=2027-02-08']}><Link to="/?day=2027-02-09">tue</Link><MapTab trip={lap} /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: 'whole trip' }))
    expect(fit()).toBe('lap|all')
    await userEvent.click(screen.getByRole('link', { name: 'tue' }))
    expect(fit()).toBe('lap|2027-02-09')
    expect(screen.getByRole('button', { name: 'whole trip' })).toHaveAttribute('aria-pressed', 'false')
  })
})

it('tapping the map says it is finding the place, then names it', async () => {
  let found!: (v: unknown) => void
  db.reverse.mockReturnValue(new Promise((r) => { found = r }))
  show()
  await userEvent.click(screen.getByRole('button', { name: 'tap map' }))
  expect(screen.getByText('finding the place')).toBeInTheDocument()
  expect(screen.queryByText('dropped pin')).toBeNull()
  await act(async () => { found({ name: 'Rovaniemi Church', lat: 66.5, lng: 25.7 }) })
  expect(screen.getByRole('region', { name: 'Rovaniemi Church' })).toBeInTheDocument()
  expect(screen.queryByText('finding the place')).toBeNull()
})

it('the map search looks near where the map is showing', async () => {
  db.search.mockResolvedValue([])
  show('/', true)
  await userEvent.click(screen.getByRole('button', { name: 'move map to paris' }))
  await userEvent.type(screen.getByRole('searchbox', { name: 'search' }), 'cafe{Enter}')
  expect(db.search).toHaveBeenLastCalledWith('cafe', { lat: 48.85, lng: 2.35, zoom: 12 })
})

it('before the map says where it is, search looks near the day\'s places', async () => {
  db.search.mockResolvedValue([])
  show('/?day=2027-02-08', true)
  await userEvent.type(screen.getByRole('searchbox', { name: 'search' }), 'cafe{Enter}')
  const near = db.search.mock.lastCall?.[1]
  expect(near.lat).toBeCloseTo(66.5, 1)
  expect(near.lng).toBeCloseTo(25.705, 2)
})

it('the day\'s list starts with the bed and names journeys by both ends', () => {
  db.stops = [
    ...db.stops,
    stop({ id: 'hostel', trip_id: 'lap', kind: 'stay', title: 'hostel', day: '2027-02-07', end_date: '2027-02-10', place: place({ name: 'Hostel', lat: 66.49, lng: 25.69 }) }),
    stop({ id: 'j', trip_id: 'lap', kind: 'journey', title: '', day: '2027-02-08', time: null, position: 9, origin: place({ name: 'Rovaniemi Airport', lat: 66.56, lng: 25.83 }), destination: place({ name: 'Helsinki Airport', lat: 60.32, lng: 24.95 }) }),
  ]
  show('/?day=2027-02-08', true)
    fireEvent.click(screen.getByRole('button', { name: 'places list' }))
  const rows = Array.from(document.querySelectorAll('.places-row')).map((r) => r.textContent)
  expect(rows).toEqual([
    'staying at hostel',
    expect.stringMatching(/^1arktikum/),
    expect.stringMatching(/^2church/),
    expect.stringMatching(/^3rovaniemi airport → helsinki airport/),
  ])
})

it('an idea\'s card adds it to the day', async () => {
  db.stops = [...db.stops, stop({ id: 'cafe', trip_id: 'lap', title: 'cafe', day: null, saved: true, place: place({ name: 'Cafe', lat: 66.5, lng: 25.72 }) })]
  show('/?day=2027-02-08', true)
  await userEvent.click(screen.getByRole('button', { name: 'tap idea' }))
  const card = screen.getByRole('region', { name: 'cafe' })
  expect(within(card).getByRole('button', { name: 'details' })).toBeInTheDocument()
  await userEvent.click(within(card).getByRole('button', { name: 'add' }))
  expect(db.save).toHaveBeenCalledWith({ id: 'cafe', day: '2027-02-08', position: 5, saved: false })
})

it('a dated, unsaved place opens with details, not add, when all days show', async () => {
  show('/', true)
  await userEvent.click(screen.getByRole('button', { name: 'tap pin' }))
  const card = screen.getByRole('region', { name: 'arktikum' })
  expect(within(card).getByRole('button', { name: 'details' })).toBeInTheDocument()
  expect(within(card).queryByRole('button', { name: 'add' })).toBeNull()
})

describe('whole trip with side trips', () => {
  const parent = trip({ id: 'ex', name: 'exchange', start_date: '2027-01-28', end_date: '2027-07-13' })
  function Where() { const l = useLocation(); return <output aria-label="where">{l.pathname + l.search}</output> }
  const showParent = (phone: boolean) => render(<MemoryRouter initialEntries={['/trip/ex?tab=map']}><MapTab trip={parent} phone={phone} /><Where /></MemoryRouter>)

  it('lists the side trips and opens one', async () => {
    db.trips = [parent, { ...lap, parent_id: 'ex' }]
    showParent(true)
    fireEvent.click(screen.getByRole('button', { name: 'places list' }))
    expect(document.querySelector('[data-overview]')).toHaveAttribute('data-overview', '1')
    expect(screen.getByText('1 side trip')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /lapland/ }))
    const where = screen.getByLabelText('where').textContent!
    expect(where).toMatch(/^\/trip\/lap\?/)
    expect(new URLSearchParams(where.split('?')[1]).get('tab')).toBe('map')
  })

  it('on a laptop a side trip opens at the trip itself', async () => {
    db.trips = [parent, { ...lap, parent_id: 'ex' }]
    db.stops = []
    showParent(false)
    expect(document.querySelector('[data-overview]')).toHaveAttribute('data-overview', '1')
    await userEvent.click(screen.getByRole('button', { name: 'tap side trip' }))
    expect(screen.getByLabelText('where').textContent).toBe('/trip/lap')
  })

  it('a change elsewhere keeps the same side-trip pins, a change to them makes new ones', () => {
    db.trips = [parent, { ...lap, parent_id: 'ex' }]
    const view = (t: typeof parent) => <MemoryRouter initialEntries={['/trip/ex?tab=map']}><MapTab trip={t} phone /></MemoryRouter>
    const { rerender } = render(view(parent))
    const first = db.overviews.at(-1)
    expect(first).toBeTruthy()
    // a realtime refresh: fresh objects, same content
    db.trips = db.trips.map((t) => ({ ...t }))
    db.stops = db.stops.map((s) => ({ ...s }))
    rerender(view({ ...parent }))
    expect(db.overviews.at(-1)).toBe(first)
    db.trips = db.trips.map((t) => t.id === 'lap' ? { ...t, name: 'lapland again' } : t)
    rerender(view({ ...parent }))
    expect(db.overviews.at(-1)).not.toBe(first)
  })

  it("a day chip's dot is the colour of the trip that owns the day", () => {
    db.trips = [{ ...parent, color: 0 }, { ...lap, parent_id: 'ex', color: 3 }]
    showParent(true)
    const scope = screen.getByRole('combobox', { name: 'map scope' })
    expect(within(scope).getByRole('option', { name: /8/ })).toHaveValue('2027-02-08')
  })

  describe('on a laptop', () => {
    const fit = () => (document.querySelector('[data-fit]') as HTMLElement).dataset.fit
    const overview = () => (document.querySelector('[data-overview]') as HTMLElement).dataset.overview
    const sideTrips = () => { db.trips = [parent, { ...lap, parent_id: 'ex' }]; db.stops = [] }
    function Read() { const r = useReadingDay(); return <button onClick={() => r.set('2027-03-01')}>read</button> }
    const open = () => render(<MemoryRouter initialEntries={['/']}><ReadingDayProvider><Link to="/?day=2027-02-20">pick</Link><Read /><MapTab trip={parent} /></ReadingDayProvider></MemoryRouter>)

    it('a trip with side trips opens the laptop map on whole trip', () => {
      sideTrips()
      open()
      expect(overview()).toBe('1')
      expect(screen.getByRole('button', { name: 'whole trip' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('picking a day on a parent trip shows that day', async () => {
      sideTrips()
      open()
      await userEvent.click(screen.getByRole('link', { name: 'pick' }))
      expect(overview()).toBe('')
      expect(fit()).toBe('ex|2027-02-20')
      expect(screen.getByRole('button', { name: 'whole trip' })).toHaveAttribute('aria-pressed', 'false')
    })

    it("reading the itinerary doesn't leave whole trip", async () => {
      sideTrips()
      open()
      await userEvent.click(screen.getByRole('button', { name: 'read' }))
      expect(overview()).toBe('1')
    })

    it('the whole trip button still switches a parent trip to its day', async () => {
      sideTrips()
      open()
      await userEvent.click(screen.getByRole('button', { name: 'whole trip' }))
      expect(overview()).toBe('')
      expect(screen.getByRole('button', { name: 'whole trip' })).toHaveAttribute('aria-pressed', 'false')
    })
  })

  it('a trip without side trips keeps every stop on whole trip', () => {
    show('/', true)
    expect(document.querySelector('[data-overview]')).toHaveAttribute('data-overview', '')
    expect(within(screen.getByRole('region', { name: 'places' })).getByText('2 places')).toBeInTheDocument()
  })

  it('the whole trip lists its stays too, before the numbered places', () => {
    db.stops = [...db.stops, stop({ id: 'hostel', trip_id: 'lap', kind: 'stay', title: 'hostel', day: '2027-02-07', end_date: '2027-02-10', place: place({ name: 'Hostel', lat: 66.49, lng: 25.69 }) })]
    show('/', true)
    fireEvent.click(screen.getByRole('button', { name: 'places list' }))
    const rows = Array.from(document.querySelectorAll('.places-row')).map((r) => r.textContent)
    expect(rows).toEqual([expect.stringMatching(/^staying at hostelsun 7 feb/), expect.stringMatching(/^1arktikum/), expect.stringMatching(/^2church/)])
  })
})
