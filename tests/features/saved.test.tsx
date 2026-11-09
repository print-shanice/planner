import { render, screen, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { trip, stop, place } from '../factories'

const db = vi.hoisted(() => ({ trips: [] as any[], links: [] as any[], stops: [] as any[], save: vi.fn(), remove: vi.fn(), linksQ: null as null | Record<string, unknown>, online: true }))
vi.mock('../../src/lib/queries', () => ({
  useTrips: () => ({ data: db.trips }),
  useLinks: () => db.linksQ ?? ({ data: db.links }),
  useStops: () => ({ data: db.stops }),
  useRates: () => ({ data: null }),
  useSave: () => ({ mutateAsync: db.save, mutate: db.save, isPending: false }),
  useRemove: () => ({ mutateAsync: db.remove, mutate: db.remove, isPending: false }),
}))
vi.mock('../../src/lib/offline', () => ({ useCanEdit: () => db.online, useOnline: () => db.online }))
const spots = vi.hoisted(() => vi.fn(() => Promise.resolve([] as unknown[])))
vi.mock('../../src/lib/photon', async (orig) => ({ ...(await orig<typeof import('../../src/lib/photon')>()), searchSpots: spots }))

import { LinksTab, SavedTab } from '../../src/features/saved/SavedTab'
import { CaptureForm } from '../../src/features/capture/CaptureForm'
import { failSave } from '../../src/lib/pending'

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
})

const show = () => render(<MemoryRouter><SavedTab trip={lap} /></MemoryRouter>)
const showLinks = () => render(<MemoryRouter><LinksTab trip={lap} /></MemoryRouter>)

it('ideas are the places and notes without a day; links have their own tab', () => {
  db.stops.push(stop({ id: 'n1', trip_id: 'lap', kind: 'note', title: 'buy wool socks', day: null, position: 1 }), stop({ trip_id: 'lap', title: 'planned', day: '2027-02-08' }))
  show()
  expect(screen.queryByRole('group', { name: /saved|show/ })).toBeNull()
  expect(within(screen.getByRole('list', { name: 'ideas' })).getAllByRole('listitem').map((li) => li.textContent)).toEqual([expect.stringContaining('kotisaari'), expect.stringContaining('buy wool socks')])
  expect(screen.queryByText('planned')).toBeNull()
  expect(screen.queryAllByTestId('link-card')).toHaveLength(0)
})

it('an idea reads as its kind and where it is', () => {
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

it('ideas and links each search their own list', async () => {
  db.stops.push(stop({ trip_id: 'lap', title: 'sauna night', day: null }))
  const r = show()
  await userEvent.type(screen.getByRole('searchbox', { name: 'search ideas' }), 'sauna')
  expect(screen.getByText('sauna night')).toBeInTheDocument()
  expect(screen.queryByText('kotisaari')).toBeNull()
  r.unmount()
  showLinks()
  await userEvent.type(screen.getByRole('searchbox', { name: 'search links' }), 'aurora')
  expect(screen.getAllByTestId('link-card')).toHaveLength(1)
})

it('an idea goes onto a day straight from its row, as the same stop', async () => {
  show()
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'add to day: kotisaari' }), '2027-02-09')
  expect(db.save).toHaveBeenCalledWith({ id: 's9', day: '2027-02-09', position: 0, saved: false })
})

it('an idea in a trip without dates picks any date', async () => {
  const nd = trip({ id: 'nd', name: 'someday', start_date: null, end_date: null })
  db.trips.push(nd)
  db.stops = [stop({ id: 'x', trip_id: 'nd', title: 'gelato', day: null })]
  render(<MemoryRouter><SavedTab trip={nd} /></MemoryRouter>)
  const pick = screen.getByLabelText('add to day: gelato')
  expect(pick).toHaveAttribute('type', 'date')
})

it('side trips without dates wait here with "set dates"', () => {
  db.trips.push(trip({ id: 'rome', parent_id: 'lap', name: 'someday rome', start_date: null, end_date: null }))
  show()
  expect(screen.getByRole('link', { name: 'someday rome' })).toHaveAttribute('href', '/trip/rome')
  expect(screen.getByRole('button', { name: 'set dates' })).toBeInTheDocument()
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

it('an idea whose save failed says so', () => {
  failSave('stops', 's9', { day: '2027-02-08' }, false)
  show()
  expect(within(screen.getByRole('list', { name: 'ideas' })).getByRole('alert')).toHaveTextContent("couldn't save")
})

describe('saving a link', () => {
  const form = (props: Partial<Parameters<typeof CaptureForm>[0]> = {}) =>
    render(<MemoryRouter><CaptureForm initial={null} tripId="lap" onDone={vi.fn()} {...props} /></MemoryRouter>)

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

it('an idea can be jotted down with just its name, no date and no form', async () => {
  show()
  await userEvent.type(screen.getByRole('textbox', { name: 'jot an idea' }), 'that rooftop bar{Enter}')
  expect(db.save).toHaveBeenCalledWith(expect.objectContaining({ trip_id: 'lap', kind: 'place', title: 'that rooftop bar', day: null }))
  expect(screen.getByRole('textbox', { name: 'jot an idea' })).toHaveValue('')
})

it('a jotted idea gets pinned to a matching place nearby, with its kind, keeping your words', async () => {
  db.trips = [{ ...lap, base: place({ lat: 66.5, lng: 25.7 }) }, trip({ id: 'par', name: 'paris' })]
  spots.mockResolvedValueOnce([place({ name: 'Kahvila Kauppayhtiö', lat: 66.501, lng: 25.72, category: 'cafe' })])
  render(<MemoryRouter><SavedTab trip={db.trips[0]} /></MemoryRouter>)
  await userEvent.type(screen.getByRole('textbox', { name: 'jot an idea' }), 'kauppayhtiö{Enter}')
  await vi.waitFor(() => expect(db.save).toHaveBeenCalledWith(expect.objectContaining({ category: 'cafe', place: expect.objectContaining({ name: 'Kahvila Kauppayhtiö' }) })))
  const pinned = db.save.mock.calls.at(-1)![0]
  expect(pinned.title).toBeUndefined()
  expect(pinned.place).not.toHaveProperty('category')
})
