import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { trip, stop, place } from '../factories'

const db = vi.hoisted(() => ({ trips: [] as any[], stops: [] as any[], save: vi.fn(), reverse: vi.fn(), stopsQ: null as null | Record<string, unknown> }))
vi.mock('../../src/lib/queries', () => ({
  useTrips: () => ({ data: db.trips }),
  useStops: () => db.stopsQ ?? ({ data: db.stops }),
  useSave: () => ({ mutateAsync: db.save, mutate: db.save, isPending: false }),
}))
vi.mock('../../src/lib/offline', () => ({ useCanEdit: () => true, useOnline: () => true }))
vi.mock('../../src/lib/photon', async (orig) => ({ ...(await orig<typeof import('../../src/lib/photon')>()), reversePlace: db.reverse }))
vi.mock('../../src/features/map/TripMap', () => ({
  TripMap: ({ onPick, onEmpty }: { onPick: (id: string) => void; onEmpty: (p: { lng: number; lat: number }) => void }) => (
    <div>
      <button onClick={() => onEmpty({ lng: 25.7287, lat: 66.5079 })}>tap map</button>
      <button onClick={() => onPick('s1')}>tap pin</button>
    </div>
  ),
}))

import { MapTab } from '../../src/features/map/MapTab'

const lap = trip({ id: 'lap', name: 'lapland', start_date: '2027-02-07', end_date: '2027-02-11' })

beforeEach(() => {
  db.trips = [lap]
  db.stops = [
    stop({ id: 's1', trip_id: 'lap', title: 'arktikum', day: '2027-02-08', position: 0, place: place({ name: 'Arktikum', lat: 66.5, lng: 25.7 }) }),
    stop({ id: 's2', trip_id: 'lap', title: 'church', day: '2027-02-08', position: 4, place: place({ lat: 66.5, lng: 25.71 }) }),
  ]
  db.save.mockReset().mockResolvedValue({})
  db.reverse.mockReset()
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
  await userEvent.click(within(card).getByRole('button', { name: 'save' }))
  expect(db.save).toHaveBeenCalledWith(expect.objectContaining({ kind: 'place', saved: true, day: null, title: 'Rovaniemi Church' }))
})

it('a pin opens its card with one primary action', async () => {
  show()
  await userEvent.click(screen.getByRole('button', { name: 'tap pin' }))
  const card = screen.getByRole('region', { name: 'arktikum' })
  expect(card.querySelectorAll('.btn.primary')).toHaveLength(1)
  expect(within(card).getByRole('link', { name: 'open in google maps' })).toBeInTheDocument()
})

it('filter chips list all days, each busy day and saved', () => {
  show()
  const chips = screen.getByRole('group', { name: 'show' })
  expect(within(chips).getAllByRole('button').map((b) => b.textContent)).toEqual(['all', 'mon 8', 'saved'])
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
    expect(within(sheet()).getByText('monday 8 · 2 places')).toBeInTheDocument()
    expect(within(sheet()).getAllByRole('button', { name: /arktikum|church/ }).map((b) => b.textContent)).toEqual([expect.stringMatching(/^1arktikum/), expect.stringMatching(/^2church/)])
  })

  it('opens and closes from its handle', async () => {
    show('/?day=2027-02-08', true)
    const handle = within(sheet()).getByRole('button', { name: 'places list' })
    expect(handle).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(handle)
    expect(handle).toHaveAttribute('aria-expanded', 'false')
    expect(within(sheet()).queryByRole('button', { name: /arktikum/ })).toBeNull()
  })

  it('tapping a row opens that place\'s card', async () => {
    show('/?day=2027-02-08', true)
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
