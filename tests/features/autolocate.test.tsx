import { render, waitFor, act } from '@testing-library/react'
import { trip, stop, place } from '../factories'

const db = vi.hoisted(() => ({ trips: [] as unknown[], stops: [] as unknown[], online: true, save: vi.fn(), find: vi.fn() }))
vi.mock('../../src/lib/queries', () => ({
  useTrips: () => ({ data: db.trips }),
  useStops: () => ({ data: db.stops }),
  useSave: () => ({ mutateAsync: db.save, mutate: db.save }),
}))
vi.mock('../../src/lib/offline', () => ({ useCanEdit: () => db.online, useOnline: () => db.online }))
vi.mock('../../src/lib/quietFind', () => ({ quietFind: db.find }))

import { useAutoLocate } from '../../src/features/itinerary/useAutoLocate'
import { useLocating } from '../../src/lib/locating'

const jp = trip({ id: 'jp', start_date: '2024-03-25', end_date: '2024-04-03', base: place({ name: 'kyoto', lat: 35.0, lng: 135.76 }) })
function Probe() { useAutoLocate(jp); return null }
function Pulse({ id }: { id: string }) { return <output data-testid={id}>{useLocating(id) ? 'finding' : ''}</output> }

beforeEach(() => {
  localStorage.clear()
  db.online = true
  db.save.mockReset()
  db.find.mockReset().mockResolvedValue(null)
  db.trips = [jp]
  db.stops = [
    stop({ id: 'obuya', trip_id: 'jp', title: 'kyoto obuya', day: '2024-03-25', place: { name: 'kyoto obuya', city: 'kyoto', lat: null, lng: null } }),
    stop({ id: 'grab', trip_id: 'jp', kind: 'note', title: 'grab to changi', day: '2024-03-25' }),
    stop({ id: 'bus', trip_id: 'jp', kind: 'journey', title: 'bus 9 to shijo omiya', day: '2024-03-25' }),
    stop({ id: 'done', trip_id: 'jp', title: 'arashiyama', day: '2024-03-26', place: place({ lat: 35.01, lng: 135.67 }) }),
    stop({ id: 'idea', trip_id: 'jp', title: 'nishiki market', day: null, place: null }),
  ]
})

it('a place line with a name and no spot is looked up near its day, once, and the spot kept', async () => {
  const found = { name: 'Obuya', lat: 35.01, lng: 135.76, category: 'restaurant', gid: 'g1' }
  db.find.mockImplementation((q: string) => Promise.resolve(q === 'kyoto obuya' ? found : null))
  render(<Probe />)
  await waitFor(() => expect(db.save).toHaveBeenCalledWith({ id: 'obuya', place: { name: 'Obuya', lat: 35.01, lng: 135.76, gid: 'g1' }, category: 'restaurant' }))
  // only places, never notes or journeys or ones with a spot; ideas too, near the trip
  expect(db.find.mock.calls.map(([q]) => q).sort()).toEqual(['kyoto obuya', 'nishiki market'])
})

it('a line tried once is not asked about again, unless it is renamed', async () => {
  render(<Probe />).unmount()
  await waitFor(() => expect(db.find).toHaveBeenCalledTimes(2))
  db.find.mockClear()
  render(<Probe />).unmount()
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
  expect(db.find).not.toHaveBeenCalled()
  db.stops = (db.stops as ReturnType<typeof stop>[]).map((s) => (s.id === 'obuya' ? { ...s, title: 'obuya kyoto' } : s))
  render(<Probe />)
  await waitFor(() => expect(db.find).toHaveBeenCalledWith('obuya kyoto', expect.anything()))
})

it('while it looks, the line says so', async () => {
  let answer!: (p: null) => void
  db.find.mockImplementation(() => new Promise((r) => { answer = r }))
  const { getByTestId } = render(<><Probe /><Pulse id="obuya" /></>)
  await waitFor(() => expect(getByTestId('obuya')).toHaveTextContent('finding'))
  await act(async () => { answer(null) })
  await waitFor(() => expect(getByTestId('obuya')).toHaveTextContent(''))
})

it('offline, nothing is looked up', async () => {
  db.online = false
  render(<Probe />)
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
  expect(db.find).not.toHaveBeenCalled()
})

it('a line added while others are being looked up is looked up after them', async () => {
  let answer!: (p: null) => void
  db.find.mockImplementationOnce(() => new Promise((r) => { answer = r })).mockResolvedValue(null)
  const { rerender } = render(<Probe />)
  await waitFor(() => expect(db.find).toHaveBeenCalledTimes(1))
  db.stops = [...(db.stops as ReturnType<typeof stop>[]), stop({ id: 'late', trip_id: 'jp', title: 'louvre museum', day: '2024-03-26', place: null })]
  rerender(<Probe />)
  await act(async () => { answer(null) })
  await waitFor(() => expect(db.find).toHaveBeenCalledWith('louvre museum', expect.anything()))
})
