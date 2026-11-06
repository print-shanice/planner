import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { trip, stop, place } from '../factories'

const db = vi.hoisted(() => ({ trips: [] as any[], links: [] as any[], stops: [] as any[], save: vi.fn(), remove: vi.fn(), linksQ: null as null | Record<string, unknown> }))
vi.mock('../../src/lib/queries', () => ({
  useTrips: () => ({ data: db.trips }),
  useLinks: () => db.linksQ ?? ({ data: db.links }),
  useStops: () => ({ data: db.stops }),
  useSave: () => ({ mutateAsync: db.save, mutate: db.save, isPending: false }),
  useRemove: () => ({ mutateAsync: db.remove, mutate: db.remove, isPending: false }),
}))
vi.mock('../../src/lib/offline', () => ({ useCanEdit: () => true, useOnline: () => true }))

import { SavedTab } from '../../src/features/saved/SavedTab'
import { LinkForm } from '../../src/features/saved/LinkForm'

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

it('lists this trip’s links newest first with a youtube player and a plain card', () => {
  show()
  const cards = screen.getAllByTestId('link-card')
  expect(cards).toHaveLength(2)
  expect(cards[0].querySelector('iframe')?.getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/abc')
  expect(within(cards[1]).getByText('skyscanner.net')).toBeInTheDocument()
})

it('saved places are listed below the links', () => {
  show()
  expect(within(screen.getByRole('region', { name: 'saved places' })).getByText('kotisaari')).toBeInTheDocument()
})

it('a link can move to another trip', async () => {
  show()
  await userEvent.click(within(screen.getAllByTestId('link-card')[1]).getByRole('button', { name: 'more' }))
  await userEvent.selectOptions(screen.getByLabelText('move to trip'), 'par')
  expect(db.save).toHaveBeenCalledWith({ id: 'l1', trip_id: 'par' })
})

it('a saved place can go onto a day', async () => {
  show()
  await userEvent.click(within(screen.getByRole('region', { name: 'saved places' })).getByRole('button', { name: 'more' }))
  await userEvent.selectOptions(screen.getByLabelText('add to day'), '2027-02-09')
  expect(db.save).toHaveBeenCalledWith(expect.objectContaining({ id: 's9', day: '2027-02-09', saved: false }))
})

it('the link form defaults the title to the host', async () => {
  const done = vi.fn()
  render(<LinkForm tripId="lap" onDone={done} />)
  await userEvent.type(screen.getByLabelText('link'), 'https://www.booking.com/hotel/fi/arctic.html')
  await userEvent.click(screen.getByRole('button', { name: 'save' }))
  expect(db.save).toHaveBeenCalledWith({ trip_id: 'lap', url: 'https://www.booking.com/hotel/fi/arctic.html', title: 'booking.com', note: '' })
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
