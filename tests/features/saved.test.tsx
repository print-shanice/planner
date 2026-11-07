import { render, screen, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { trip, stop, place } from '../factories'

const db = vi.hoisted(() => ({ trips: [] as any[], links: [] as any[], stops: [] as any[], save: vi.fn(), remove: vi.fn(), linksQ: null as null | Record<string, unknown> }))
vi.mock('../../src/lib/queries', () => ({
  useTrips: () => ({ data: db.trips }),
  useLinks: () => db.linksQ ?? ({ data: db.links }),
  useStops: () => ({ data: db.stops }),
  useRates: () => ({ data: null }),
  useSave: () => ({ mutateAsync: db.save, mutate: db.save, isPending: false }),
  useRemove: () => ({ mutateAsync: db.remove, mutate: db.remove, isPending: false }),
}))
vi.mock('../../src/lib/offline', () => ({ useCanEdit: () => true, useOnline: () => true }))

import { SavedTab } from '../../src/features/saved/SavedTab'
import { LinkForm } from '../../src/features/saved/LinkForm'
import { failSave, forgetPending } from '../../src/lib/pending'

const lap = trip({ id: 'lap', name: 'lapland', start_date: '2027-02-07', end_date: '2027-02-11' })

beforeEach(() => {
  db.trips = [lap, trip({ id: 'par', name: 'paris' })]
  db.links = [
    { id: 'l1', trip_id: 'lap', url: 'https://skyscanner.net/flights/ein-rvn', title: '', note: '', created_at: '2026-11-01T00:00:00Z' },
    { id: 'l2', trip_id: 'lap', url: 'https://youtu.be/abc', title: 'aurora tips', note: '', created_at: '2026-11-03T00:00:00Z' },
    { id: 'l3', trip_id: 'par', url: 'https://example.com', title: 'not mine', note: '', created_at: '2026-11-04T00:00:00Z' },
  ]
  db.stops = [stop({ id: 's9', trip_id: 'lap', title: 'kotisaari', day: null, saved: true, place: place({ name: 'Kotisaari' }) })]
  db.save.mockReset().mockResolvedValue({}); db.remove.mockReset().mockResolvedValue(undefined)
})

const show = () => render(<MemoryRouter><SavedTab trip={lap} /></MemoryRouter>)
const showLinks = async () => { show(); await userEvent.click(screen.getByRole('button', { name: /^links/ })) }

it('links are tidy rows, newest first: title above its site, the note after, no players', async () => {
  db.links[1].note = 'watch before'
  await showLinks()
  const cards = screen.getAllByTestId('link-card')
  expect(cards).toHaveLength(2)
  expect(document.querySelector('iframe, blockquote')).toBeNull()
  const first = within(cards[0])
  expect(first.getByText('aurora tips')).toHaveClass('link-title')
  expect(first.getByText('youtu.be · watch before')).toBeInTheDocument()
  expect(first.getByRole('link')).toHaveAttribute('target', '_blank')
  expect(within(cards[1]).getByText('skyscanner.net')).toBeInTheDocument()
})

it('saved splits into ideas and links, ideas first', async () => {
  show()
  expect(within(screen.getByRole('list', { name: 'ideas' })).getByText('kotisaari')).toBeInTheDocument()
  expect(screen.queryAllByTestId('link-card')).toHaveLength(0)
  await userEvent.click(screen.getByRole('button', { name: /^links/ }))
  expect(screen.getAllByTestId('link-card')).toHaveLength(2)
  expect(screen.queryByText('kotisaari')).toBeNull()
})

it('each side has its own search', async () => {
  db.stops.push(stop({ trip_id: 'lap', title: 'sauna night', day: null }))
  show()
  await userEvent.type(screen.getByRole('searchbox', { name: 'search ideas' }), 'sauna')
  expect(screen.getByText('sauna night')).toBeInTheDocument()
  expect(screen.queryByText('kotisaari')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: /^links/ }))
  await userEvent.type(screen.getByRole('searchbox', { name: 'search links' }), 'aurora')
  expect(screen.getAllByTestId('link-card')).toHaveLength(1)
})

it('links show their website icon', async () => {
  await showLinks()
  const icon = screen.getAllByTestId('link-card')[1].querySelector('img.site-icon')
  expect(icon?.getAttribute('src')).toContain('skyscanner.net')
})

it('several links can be picked and deleted together', async () => {
  await showLinks()
  await userEvent.click(screen.getByRole('button', { name: 'select' }))
  await userEvent.click(screen.getByRole('checkbox', { name: 'aurora tips' }))
  await userEvent.click(screen.getByRole('checkbox', { name: 'skyscanner.net' }))
  await userEvent.click(screen.getByRole('button', { name: 'delete 2' }))
  await userEvent.click(screen.getByRole('button', { name: 'tap again to delete' }))
  expect(db.remove.mock.calls.map((c) => c[0]).sort()).toEqual(['l1', 'l2'])
})

it('select all picks every idea shown', async () => {
  db.stops.push(stop({ id: 'u2', trip_id: 'lap', title: 'husky ride', day: null }))
  show()
  await userEvent.click(screen.getByRole('button', { name: 'select' }))
  await userEvent.click(screen.getByRole('button', { name: 'select all' }))
  expect(screen.getByRole('button', { name: 'delete 2' })).toBeInTheDocument()
})

it('undated plans and undated side trips wait under "no date"', async () => {
  db.trips = [lap, trip({ id: 'kid', parent_id: 'lap', name: 'someday sauna', start_date: null, end_date: null })]
  db.stops = [stop({ id: 'u1', trip_id: 'lap', title: 'husky ride', day: null })]
  show()
  const box = within(screen.getByRole('list', { name: 'ideas' }))
  expect(box.getByText('husky ride')).toBeInTheDocument()
  expect(box.getByRole('link', { name: /someday sauna/ })).toHaveAttribute('href', '/trip/kid')
  await userEvent.click(box.getByRole('button', { name: 'set dates' }))
  expect(screen.getByRole('dialog', { name: 'edit trip' })).toBeInTheDocument()
})

it('a link can move to another trip', async () => {
  await showLinks()
  await userEvent.click(within(screen.getAllByTestId('link-card')[1]).getByRole('button', { name: 'more' }))
  await userEvent.selectOptions(screen.getByLabelText('move to trip'), 'par')
  expect(db.save).toHaveBeenCalledWith({ id: 'l1', trip_id: 'par' })
})

it('a saved place can go onto a day', async () => {
  show()
  await userEvent.click(within(screen.getByRole('list', { name: 'ideas' })).getByRole('button', { name: 'more' }))
  await userEvent.selectOptions(screen.getByLabelText('add to day'), '2027-02-09')
  expect(db.save).toHaveBeenCalledWith(expect.objectContaining({ id: 's9', day: '2027-02-09', saved: false }))
})

it('the link form defaults the title to the host', async () => {
  const done = vi.fn()
  render(<LinkForm tripId="lap" onDone={done} />)
  await userEvent.type(screen.getByLabelText('link'), 'https://www.booking.com/hotel/fi/arctic.html')
  await userEvent.click(screen.getByRole('button', { name: 'save' }))
  expect(db.save).toHaveBeenCalledWith({ id: expect.any(String), trip_id: 'lap', url: 'https://www.booking.com/hotel/fi/arctic.html', title: 'booking.com', note: '' })
  expect(done).toHaveBeenCalled()
})

const loading = { data: undefined, status: 'pending', fetchStatus: 'fetching' }

beforeEach(() => { db.linksQ = null })

it('links still loading are not "nothing saved yet"', () => {
  db.linksQ = loading
  show()
  expect(screen.getByRole('status', { name: 'loading' })).toBeInTheDocument()
  expect(screen.queryByText('nothing saved yet')).toBeNull()
})

afterEach(() => forgetPending())

it('a link whose save failed says so', async () => {
  failSave('links', 'l2', { trip_id: 'par' }, false)
  await showLinks()
  expect(within(screen.getAllByTestId('link-card')[0]).getByRole('alert')).toHaveTextContent("couldn't save")
})

it('a saved place whose save failed says so', () => {
  failSave('stops', 's9', { day: '2027-02-08' }, false)
  show()
  expect(within(screen.getByRole('list', { name: 'ideas' })).getByRole('alert')).toHaveTextContent("couldn't save")
})

it('saving a link again after it failed sends the same new row, not a second one', async () => {
  db.save.mockReset().mockRejectedValueOnce(new Error('asleep')).mockResolvedValue({})
  render(<LinkForm tripId="lap" onDone={vi.fn()} />)
  await userEvent.type(screen.getByLabelText('link'), 'https://example.com')
  await userEvent.click(screen.getByRole('button', { name: 'save' }))
  await userEvent.click(await screen.findByRole('button', { name: 'retry' }))
  const [a, b] = db.save.mock.calls.map((c) => c[0].id)
  expect(a).toEqual(expect.any(String))
  expect(b).toBe(a)
})

it('a new link keeps its draft per trip and says when it could not save', async () => {
  const first = render(<LinkForm tripId="lap" onDone={vi.fn()} />)
  await userEvent.type(screen.getByLabelText('link'), 'example.com')
  first.unmount()
  render(<LinkForm tripId="par" onDone={vi.fn()} />)
  expect(screen.getByLabelText('link')).toHaveValue('')
  cleanup()
  db.save.mockReset().mockRejectedValueOnce(new Error('asleep')).mockResolvedValue({})
  const done = vi.fn()
  render(<LinkForm tripId="lap" onDone={done} />)
  expect(screen.getByLabelText('link')).toHaveValue('example.com')
  await userEvent.click(screen.getByRole('button', { name: 'save' }))
  expect(await screen.findByText("couldn't save")).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'retry' }))
  expect(db.save.mock.calls[1][0].id).toBe(db.save.mock.calls[0][0].id)
  expect(done).toHaveBeenCalled()
})

it('edits a link locally and sends only changed fields', async () => {
  await showLinks()
  await userEvent.click(within(screen.getAllByTestId('link-card')[1]).getByRole('button', { name: 'more' }))
  await userEvent.click(screen.getByRole('button', { name: 'edit link' }))
  const dialog = screen.getByRole('dialog', { name: 'edit link' })
  await userEvent.type(within(dialog).getByLabelText('title'), 'flights')
  await userEvent.click(within(dialog).getByRole('button', { name: 'save' }))
  expect(db.save).toHaveBeenCalledWith({ id: 'l1', title: 'flights' })
})
