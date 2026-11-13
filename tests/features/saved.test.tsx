import { act, render, screen, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { trip, stop, place } from '../factories'

const db = vi.hoisted(() => ({ costs: [] as any[], trips: [] as any[], links: [] as any[], stops: [] as any[], save: vi.fn(), remove: vi.fn(), linksQ: null as null | Record<string, unknown>, online: true }))
vi.mock('../../src/lib/queries', () => ({
  useTrips: () => ({ data: db.trips }),
  useLinks: () => db.linksQ ?? ({ data: db.links }),
  useStops: () => ({ data: db.stops }),
  useRates: () => ({ data: null }),
  useCosts: () => ({ data: db.costs }),
  useSave: () => ({ mutateAsync: db.save, mutate: db.save, isPending: false }),
  useRemove: () => ({ mutateAsync: db.remove, mutate: db.remove, isPending: false }),
}))
vi.mock('../../src/lib/offline', () => ({ useCanEdit: () => db.online, useOnline: () => db.online }))
const spots = vi.hoisted(() => vi.fn(() => Promise.resolve([] as unknown[])))
const found = vi.hoisted(() => vi.fn(() => Promise.resolve([] as unknown[])))
vi.mock('../../src/lib/photon', async (orig) => ({ ...(await orig<typeof import('../../src/lib/photon')>()), searchSpots: spots, searchPlaces: found }))

import { LinksTab } from '../../src/features/saved/SavedTab'
import { PlacesTab } from '../../src/features/places/PlacesTab'
import { Icon } from '../../src/components/Icon'
import { CaptureForm } from '../../src/features/capture/CaptureForm'
import { failSave } from '../../src/lib/pending'
import { setLocating } from '../../src/lib/locating'

const lap = trip({ id: 'lap', name: 'lapland', start_date: '2027-02-07', end_date: '2027-02-11' })

beforeEach(() => {
  db.online = true
  db.trips = [lap, trip({ id: 'par', name: 'paris' })]
  db.links = [
    { id: 'l1', trip_id: 'lap', url: 'https://skyscanner.net/flights/ein-rvn', title: '', note: '', created_at: '2026-11-01T00:00:00Z' },
    { id: 'l2', trip_id: 'lap', url: 'https://youtu.be/abc', title: 'aurora tips', note: '', created_at: '2026-11-03T00:00:00Z' },
    { id: 'l3', trip_id: 'par', url: 'https://example.com', title: 'not mine', note: '', created_at: '2026-11-04T00:00:00Z' },
  ]
  db.stops = [stop({ id: 's9', trip_id: 'lap', title: 'kotisaari', day: null, saved: true, category: 'restaurant', place: place({ name: 'Kotisaari', city: 'rovaniemi' }) })]
  db.save.mockReset().mockResolvedValue({}); db.remove.mockReset().mockResolvedValue(undefined)
  db.costs = []; found.mockReset().mockResolvedValue([])
})

afterEach(() => { delete (window as { matchMedia?: unknown }).matchMedia })
const show = () => render(<MemoryRouter><PlacesTab trip={lap} /></MemoryRouter>)
function Where() { return <output data-testid="where">{useLocation().search}</output> }
const showLinks = () => render(<MemoryRouter><LinksTab trip={lap} /></MemoryRouter>)

it('places are every place in the trip, the ones in the itinerary too (stays included), in one list with no dates; notes live elsewhere', () => {
  db.stops.push(
    stop({ id: 'n1', trip_id: 'lap', kind: 'note', title: 'buy wool socks', day: null, position: 1 }),
    stop({ id: 'pl', trip_id: 'lap', title: 'planned', day: '2027-02-08' }),
    stop({ id: 'st', trip_id: 'lap', kind: 'stay', title: 'glass igloo', day: '2027-02-07', end_date: '2027-02-10' }),
    stop({ id: 'jn', trip_id: 'lap', kind: 'journey', title: 'flight in', day: '2027-02-07' }),
  )
  show()
  expect(screen.queryByRole('group', { name: /saved|show/ })).toBeNull()
  const rows = within(screen.getByRole('list', { name: 'places' })).getAllByRole('listitem').map((li) => li.textContent)
  expect(rows).toEqual([expect.stringContaining('kotisaari'), expect.stringContaining('glass igloo'), expect.stringContaining('planned')])
  // a planned place shows no day and nothing to pick; one not planned yet can go onto a day
  expect(rows[1]).not.toMatch(/feb/)
  expect(rows[2]).not.toMatch(/feb/)
  expect(screen.queryByRole('combobox', { name: /planned|glass igloo/ })).toBeNull()
  expect(screen.getByRole('combobox', { name: 'add to day: kotisaari' })).toBeInTheDocument()
  expect(screen.queryByText('buy wool socks')).toBeNull()
  expect(screen.queryByText('flight in')).toBeNull()
  expect(screen.queryAllByTestId('link-card')).toHaveLength(0)
})

it('each place wears the same mark as its pin on the map beside: a plain ring with its kind, a bed for a stay', () => {
  db.stops.push(stop({ id: 'st', trip_id: 'lap', kind: 'stay', title: 'new lion city hotel', day: '2027-02-07', end_date: '2027-02-10' }), stop({ id: 'pl', trip_id: 'lap', title: 'planned', day: '2027-02-08', category: 'cafe' }))
  const { container } = show()
  const mark = (id: string) => container.querySelector(`[data-stop="${id}"] .cat`)!
  for (const id of ['s9', 'st', 'pl']) expect(mark(id)).toHaveClass('quiet')
  const bed = render(<Icon name="bed" />).container.querySelector('path')!.getAttribute('d')
  expect(mark('st').querySelector('path')!.getAttribute('d')).toBe(bed)
})

it('a place\'s mark shows it on the map, like a numbered line in the plan; a place without a spot has nothing to show', async () => {
  db.stops = [
    stop({ id: 's9', trip_id: 'lap', title: 'kotisaari', day: null, place: place({ name: 'Kotisaari', lat: 66.5, lng: 25.7 }) }),
    stop({ id: 'pl', trip_id: 'lap', title: 'planned', day: '2027-02-08', place: place({ lat: 66.4, lng: 25.6 }) }),
    stop({ id: 'nm', trip_id: 'lap', title: 'name only', day: null, place: null }),
  ]
  window.matchMedia = ((q: string) => ({ matches: q.includes('1024'), media: q, addEventListener() {}, removeEventListener() {} })) as never
  render(<MemoryRouter initialEntries={['/trip/lap?tab=places']}><PlacesTab trip={lap} /><Where /></MemoryRouter>)
  await userEvent.click(screen.getByRole('button', { name: 'show kotisaari on the map' }))
  expect(new URLSearchParams(screen.getByTestId('where').textContent!).get('pin')).toBe('s9')
  await userEvent.click(screen.getByRole('button', { name: 'show planned on the map' }))
  const after = new URLSearchParams(screen.getByTestId('where').textContent!)
  expect(after.get('pin')).toBe('pl')
  expect(after.get('tab')).toBe('places')
  expect(screen.queryByRole('button', { name: 'show name only on the map' })).toBeNull()
})

it('on a phone the mark goes to the map tab, on the place', async () => {
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never
  db.stops = [stop({ id: 's9', trip_id: 'lap', title: 'kotisaari', day: null, place: place({ name: 'Kotisaari', lat: 66.5, lng: 25.7 }) })]
  render(<MemoryRouter initialEntries={['/trip/lap?tab=places']}><PlacesTab trip={lap} /><Where /></MemoryRouter>)
  await userEvent.click(screen.getByRole('button', { name: 'show kotisaari on the map' }))
  const after = new URLSearchParams(screen.getByTestId('where').textContent!)
  expect(after.get('tab')).toBe('map')
  expect(after.get('pin')).toBe('s9')
  expect(after.get('map')).toBe('saved')
})

it('a kind filter shows only that kind, and the map is told which places show', async () => {
  db.stops.push(stop({ id: 'c1', trip_id: 'lap', title: 'kahvila', day: null, category: 'cafe', position: 1 }))
  show()
  const kinds = screen.getByRole('group', { name: 'kind' })
  expect(within(kinds).getAllByRole('button').map((b) => b.textContent)).toEqual(['all', 'cafe · 1', 'restaurant · 1'])
  await userEvent.click(within(kinds).getByRole('button', { name: 'cafe · 1' }))
  expect(screen.getByText('kahvila')).toBeInTheDocument()
  expect(screen.queryByText('kotisaari')).toBeNull()
  const { shownPlaces } = await import('../../src/lib/shownPlaces')
  expect(shownPlaces()).toEqual(['c1'])
})

it('adding a place searches for it; picking a result saves it with its spot, not planned yet', async () => {
  found.mockResolvedValue([place({ name: 'Arktikum', lat: 66.51, lng: 25.73, category: 'museum' })])
  show()
  await userEvent.type(screen.getByRole('combobox', { name: 'add a place' }), 'arktik')
  await userEvent.click(await screen.findByRole('button', { name: /Arktikum/ }))
  expect(db.save).toHaveBeenCalledWith(expect.objectContaining({ trip_id: 'lap', kind: 'place', title: 'Arktikum', day: null, category: 'museum', place: expect.objectContaining({ lat: 66.51, lng: 25.73 }) }))
  expect(screen.getByRole('combobox', { name: 'add a place' })).toHaveValue('')
})

it('a place already there is not added twice: it says where it is instead', async () => {
  found.mockResolvedValue([place({ name: 'Kotisaari', lat: 52, lng: 5 })])
  show()
  await userEvent.type(screen.getByRole('combobox', { name: 'add a place' }), 'kotis')
  await userEvent.click(await screen.findByRole('button', { name: /Kotisaari/ }))
  expect(db.save).not.toHaveBeenCalled()
  expect(screen.getByRole('status', { name: 'already there' })).toHaveTextContent('kotisaari is already in places')
})

it('typing a name already there and pressing add is blocked too', async () => {
  show()
  await userEvent.type(screen.getByRole('combobox', { name: 'add a place' }), 'KOTISAARI')
  await userEvent.click(screen.getByRole('button', { name: 'add place' }))
  expect(db.save).not.toHaveBeenCalled()
  expect(screen.getByRole('status', { name: 'already there' })).toHaveTextContent('already in places')
})

it('on a trip with side trips, a place can go to a side trip, its costs with it', async () => {
  db.trips.push(trip({ id: 'ivalo', parent_id: 'lap', name: 'ivalo', start_date: null, end_date: null }))
  db.costs = [{ id: 'c', trip_id: 'lap', stop_id: 's9' }]
  show()
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'add to day: kotisaari' }), 'trip:ivalo')
  expect(db.save).toHaveBeenCalledWith({ id: 's9', trip_id: 'ivalo' })
  expect(db.save).toHaveBeenCalledWith({ id: 'c', trip_id: 'ivalo' })
})

it('a place reads as its kind and where it is', () => {
  show()
  expect(screen.getByText('restaurant · rovaniemi')).toBeInTheDocument()
})

it('links are tidy rows, newest first: title above its site, the note after, no players', () => {
  db.links[1].note = 'watch before'
  showLinks()
  const cards = screen.getAllByTestId('link-card')
  expect(document.querySelector('iframe, blockquote')).toBeNull()
  const first = within(cards[0])
  expect(first.getByText('aurora tips')).toHaveClass('link-title')
  expect(first.getByText('youtu.be · watch before')).toBeInTheDocument()
  expect(first.getByRole('link')).toHaveAttribute('target', '_blank')
  expect(within(cards[1]).getByText('skyscanner.net')).toBeInTheDocument()
})

it('places and links each search their own list', async () => {
  db.stops.push(stop({ trip_id: 'lap', title: 'sauna night', day: null }))
  const r = show()
  await userEvent.type(screen.getByRole('searchbox', { name: 'search places' }), 'sauna')
  expect(screen.getByText('sauna night')).toBeInTheDocument()
  expect(screen.queryByText('kotisaari')).toBeNull()
  r.unmount()
  showLinks()
  await userEvent.type(screen.getByRole('searchbox', { name: 'search links' }), 'aurora')
  expect(screen.getAllByTestId('link-card')).toHaveLength(1)
})

it('a place goes onto a day straight from its row, as the same stop', async () => {
  show()
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'add to day: kotisaari' }), 'day:2027-02-09')
  expect(db.save).toHaveBeenCalledWith(expect.objectContaining({ id: 's9', day: '2027-02-09', saved: false }))
})

it('a place in a trip without dates picks any date', async () => {
  const nd = trip({ id: 'nd', name: 'someday', start_date: null, end_date: null })
  db.trips.push(nd)
  db.stops = [stop({ id: 'x', trip_id: 'nd', title: 'gelato', day: null })]
  render(<MemoryRouter><PlacesTab trip={nd} /></MemoryRouter>)
  const pick = screen.getByLabelText('add to day: gelato')
  expect(pick).toHaveAttribute('type', 'date')
})

it('side trips without dates are not listed with places (home and the trip tree show them)', () => {
  db.trips.push(trip({ id: 'rome', parent_id: 'lap', name: 'someday rome', start_date: null, end_date: null }))
  show()
  expect(screen.queryByRole('link', { name: 'someday rome' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'set dates' })).toBeNull()
})

it('a link is added right in the links tab: pasted, named after its site, for this trip', async () => {
  showLinks()
  await userEvent.type(screen.getByRole('textbox', { name: 'add a link' }), 'look https://www.instagram.com/reel/NEW1/ !')
  await userEvent.click(screen.getByRole('button', { name: 'add link' }))
  expect(db.save).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://www.instagram.com/reel/NEW1/', title: 'instagram', trip_id: 'lap', stop_id: null }))
  expect(screen.getByRole('textbox', { name: 'add a link' })).toHaveValue('')
})

it('a link already in this trip is not added twice', async () => {
  showLinks()
  await userEvent.type(screen.getByRole('textbox', { name: 'add a link' }), 'https://youtu.be/abc{Enter}')
  expect(db.save).not.toHaveBeenCalled()
  expect(screen.getByRole('status', { name: 'already there' })).toHaveTextContent('already in links')
})

it('a link saved in another trip moves here instead of being added again', async () => {
  showLinks()
  await userEvent.type(screen.getByRole('textbox', { name: 'add a link' }), 'https://example.com{Enter}')
  expect(db.save).toHaveBeenCalledWith({ id: 'l3', trip_id: 'lap' })
})

it('something that is not a link says so', async () => {
  showLinks()
  await userEvent.type(screen.getByRole('textbox', { name: 'add a link' }), 'hello there{Enter}')
  expect(db.save).not.toHaveBeenCalled()
  expect(screen.getByRole('alert')).toHaveTextContent('check the link')
})

it('a link can move to another trip', async () => {
  showLinks()
  await userEvent.click(within(screen.getAllByTestId('link-card')[0]).getByRole('button', { name: 'more' }))
  await userEvent.selectOptions(screen.getByLabelText('move to trip'), 'par')
  expect(db.save).toHaveBeenCalledWith({ id: 'l2', trip_id: 'par' })
})

it('a link for a place says which, and the place says it has one', () => {
  db.links[1].stop_id = 's9'
  const r = showLinks()
  expect(within(screen.getAllByTestId('link-card')[0]).getByRole('button', { name: 'kotisaari →' })).toBeInTheDocument()
  r.unmount()
  show()
  expect(screen.getByText(/1 link/)).toBeInTheDocument()
})

it('links still loading are not "no links yet"', () => {
  db.links = []
  db.linksQ = { data: undefined, status: 'pending', fetchStatus: 'fetching' }
  showLinks()
  expect(screen.queryByText('no links yet')).toBeNull()
  db.linksQ = null
})

it('a link whose save failed says so', () => {
  failSave('links', 'l2', { trip_id: 'par' }, false)
  showLinks()
  expect(within(screen.getAllByTestId('link-card')[0]).getByRole('alert')).toHaveTextContent("couldn't save")
})

it('a place whose save failed says so', () => {
  failSave('stops', 's9', { day: '2027-02-08' }, false)
  show()
  expect(within(screen.getByRole('list', { name: 'places' })).getByRole('alert')).toHaveTextContent("couldn't save")
})

describe('saving a link', () => {
  const form = (props: Partial<Parameters<typeof CaptureForm>[0]> = {}) =>
    render(<MemoryRouter><CaptureForm initial={null} tripId="lap" onDone={vi.fn()} {...props} /></MemoryRouter>)

  it('a new link with something typed can be cleared, and its draft goes with it', async () => {
    form()
    expect(screen.queryByRole('button', { name: 'clear' })).toBeNull()
    await userEvent.type(screen.getByLabelText('link'), 'https://example.com/x')
    await userEvent.click(screen.getByRole('button', { name: 'clear' }))
    expect(screen.getByLabelText('link')).toHaveValue('')
    expect(screen.queryByRole('button', { name: 'clear' })).toBeNull()
    expect(localStorage.getItem('planner-drafts')).toBeNull()
  })

  it('needs only the link: a reel is named after where it came from, with no date anywhere', async () => {
    form()
    expect(screen.queryByLabelText(/day|date|time/)).toBeNull()
    await userEvent.type(screen.getByLabelText('link'), 'https://www.instagram.com/reel/C9x/?igsh=1')
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    expect(db.save).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://www.instagram.com/reel/C9x/?igsh=1', title: 'instagram', trip_id: 'lap', stop_id: null }))
  })

  it('takes the link out of shared text', async () => {
    form({ initial: { url: '', title: '', text: 'look at this https://vm.tiktok.com/ZM1/ !!' }, tripId: null })
    expect(screen.getByLabelText('link')).toHaveValue('https://vm.tiktok.com/ZM1/')
    expect(screen.getByLabelText('trip')).toHaveValue('')
  })

  it('without a trip it goes to the inbox', async () => {
    form({ tripId: null })
    await userEvent.type(screen.getByLabelText('link'), 'example.org/page')
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    expect(db.save).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://example.org/page', trip_id: null }))
  })

  it('a link saved before is recognised, and saving moves it instead of adding a second', async () => {
    form({ initial: { url: 'https://youtube.com/watch?v=abc&si=x', title: '', text: '' }, tripId: null })
    expect(screen.getByRole('status')).toHaveTextContent('already saved in lapland')
    await userEvent.selectOptions(screen.getByLabelText('trip'), 'par')
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    expect(db.save).toHaveBeenCalledTimes(1)
    expect(db.save.mock.calls[0][0]).toMatchObject({ id: 'l2', trip_id: 'par' })
  })

  it('can be for a place in the trip', async () => {
    db.stops.push(stop({ id: 'cafe', trip_id: 'lap', title: 'kahvila', day: '2027-02-08' }))
    form()
    await userEvent.type(screen.getByLabelText('link'), 'https://a.com')
    await userEvent.selectOptions(screen.getByLabelText('for a place'), 'cafe')
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    expect(db.save).toHaveBeenCalledWith(expect.objectContaining({ stop_id: 'cafe' }))
  })

  it('offline it says it is not saved, and saves nothing', async () => {
    db.online = false
    form({ initial: { url: 'https://a.com', title: '', text: '' }, tripId: null })
    expect(screen.getByRole('alert')).toHaveTextContent('offline')
    expect(screen.getByRole('button', { name: 'save' })).toBeDisabled()
  })

  it('saving again after a failure sends the same new row, not a second one', async () => {
    db.save.mockReset().mockRejectedValueOnce(new Error('asleep')).mockResolvedValue({})
    form()
    await userEvent.type(screen.getByLabelText('link'), 'https://example.com/x')
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    await userEvent.click(await screen.findByRole('button', { name: 'retry' }))
    const [a, b] = db.save.mock.calls.map((c) => c[0].id)
    expect(b).toBe(a)
  })

  it('a link typed in a trip keeps its draft until it is saved', async () => {
    const first = form()
    await userEvent.type(screen.getByLabelText('link'), 'example.com')
    first.unmount()
    form({ tripId: 'par' })
    expect(screen.getByLabelText('link')).toHaveValue('')
    cleanup()
    form()
    expect(screen.getByLabelText('link')).toHaveValue('example.com')
  })

  it('editing sends only what changed', async () => {
    form({ link: db.links[0] })
    await userEvent.type(screen.getByLabelText('title'), 'flights')
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    expect(db.save).toHaveBeenCalledWith({ id: 'l1', title: 'flights' })
  })
})

it('a new link being saved never calls itself already saved', async () => {
  db.save.mockImplementation(async (row: any) => { db.links.push({ ...row, created_at: '2026-11-09' }); return row })
  const { rerender } = render(<MemoryRouter><CaptureForm initial={{ url: 'https://www.instagram.com/reel/NEW/', title: '', text: '' }} tripId={null} onDone={vi.fn()} /></MemoryRouter>)
  await userEvent.click(screen.getByRole('button', { name: 'save' }))
  rerender(<MemoryRouter><CaptureForm initial={{ url: 'https://www.instagram.com/reel/NEW/', title: '', text: '' }} tripId={null} onDone={vi.fn()} /></MemoryRouter>)
  expect(screen.queryByText(/already saved/)).toBeNull()
})

it('enter adds the name as typed, no date and no form (the place finder pins it later)', async () => {
  show()
  await userEvent.type(screen.getByRole('combobox', { name: 'add a place' }), 'that rooftop bar{Enter}')
  expect(db.save).toHaveBeenCalledWith(expect.objectContaining({ trip_id: 'lap', kind: 'place', title: 'that rooftop bar', day: null }))
  expect(screen.getByRole('combobox', { name: 'add a place' })).toHaveValue('')
})

it("a jotted place is left to the trip's own place finder, and its row says so while it looks", async () => {
  db.trips = [{ ...lap, base: place({ lat: 66.5, lng: 25.7 }) }, trip({ id: 'par', name: 'paris' })]
  render(<MemoryRouter><PlacesTab trip={db.trips[0]} /></MemoryRouter>)
  await userEvent.type(screen.getByRole('combobox', { name: 'add a place' }), 'kauppayhtiö{Enter}')
  expect(db.save).toHaveBeenCalledTimes(1)
  expect(spots).not.toHaveBeenCalled()
  const row = screen.getByRole('button', { name: /^kotisaari/ })
  expect(within(row).queryByText('finding the place')).toBeNull()
  act(() => setLocating('s9', true))
  expect(within(row).getByText('finding the place')).toBeInTheDocument()
  act(() => setLocating('s9', false))
})
