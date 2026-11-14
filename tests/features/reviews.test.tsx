import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Reviews } from '../../src/features/stops/Reviews'
import { stop, place, trip } from '../factories'
import type { Review, Trip } from '../../src/lib/types'
const db = vi.hoisted(() => ({ reviews: [] as Review[], trips: [] as Trip[], save: vi.fn(), editable: true }))
vi.mock('../../src/lib/auth', () => ({ useAuth: () => ({ userId: 'me' }) }))
vi.mock('../../src/lib/offline', () => ({ useCanEdit: () => db.editable }))
vi.mock('../../src/lib/queries', () => ({
  useReviews: () => ({ data: db.reviews }), useLinks: () => ({ data: [] }),
  useStops: () => ({ data: [] }), useTrips: () => ({ data: db.trips }), useMembers: () => ({ data: [] }),
  useSave: () => ({ mutateAsync: db.save, isPending: false }),
}))
const s = stop({ id: 'visit', place: place() })
beforeEach(() => {
  db.reviews = []; db.editable = true; db.save.mockReset().mockResolvedValue({})
  db.trips = [trip({ id: 't0', start_date: '2027-02-07', end_date: '2027-02-11' })]
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2027-02-12T10:00:00'))
})
afterEach(() => vi.useRealTimers())
it('stays hidden until the trip is over', () => {
  vi.setSystemTime(new Date('2027-02-11T22:00:00'))
  db.reviews = [{ id: 'old', stop_id: s.id, author_id: 'you', comments: 'loved it', rating: 5, return_choice: 'yes', outcome: 'done' }]
  const ui = render(<Reviews stop={s} />)
  expect(screen.queryByRole('region', { name: 'reviews' })).toBeNull()
  expect(screen.queryByText('loved it')).toBeNull()
  vi.setSystemTime(new Date('2027-02-12T08:00:00'))
  ui.rerender(<Reviews stop={{ ...s }} />)
  expect(screen.getByRole('region', { name: 'reviews' })).toBeInTheDocument()
})
it('stays hidden for a trip without dates', () => {
  db.trips = [trip({ id: 't0', start_date: null, end_date: null })]
  render(<Reviews stop={s} />)
  expect(screen.queryByRole('region', { name: 'reviews' })).toBeNull()
})
it('each pick saves at once, comments save when left, and there is no save button', async () => {
  render(<Reviews stop={s} />)
  expect(screen.queryByRole('button', { name: /save/ })).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'done' }))
  expect(db.save).toHaveBeenLastCalledWith(expect.objectContaining({ stop_id: 'visit', author_id: 'me', outcome: 'done', rating: null }))
  await userEvent.click(screen.getByRole('button', { name: '4 of 5' }))
  await userEvent.click(screen.getByRole('button', { name: 'yes' }))
  expect(screen.getByRole('button', { name: '4 of 5' })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.type(screen.getByLabelText('comments'), 'go early')
  await userEvent.tab()
  expect(db.save).toHaveBeenLastCalledWith(expect.objectContaining({ rating: 4, return_choice: 'yes', outcome: 'done', comments: 'go early' }))
  // every save is the same review
  expect(new Set(db.save.mock.calls.map((c) => c[0].id)).size).toBe(1)
})
it('a picked rating tapped again is unpicked', async () => {
  render(<Reviews stop={s} />)
  await userEvent.click(screen.getByRole('button', { name: '3 of 5' }))
  await userEvent.click(screen.getByRole('button', { name: '3 of 5' }))
  expect(db.save).toHaveBeenLastCalledWith(expect.objectContaining({ rating: null }))
})
it('keeps typed notes after failure and retries the same review id', async () => {
  db.save.mockRejectedValueOnce(new Error('failed')).mockResolvedValue({})
  render(<Reviews stop={s} />)
  fireEvent.change(screen.getByLabelText('comments'), { target: { value: 'keep this' } })
  fireEvent.blur(screen.getByLabelText('comments'))
  expect(await screen.findByRole('button', { name: 'retry' })).toBeInTheDocument()
  expect(screen.getByLabelText('comments')).toHaveValue('keep this')
  await userEvent.click(screen.getByRole('button', { name: 'retry' }))
  expect(db.save.mock.calls[0][0].id).toBe(db.save.mock.calls[1][0].id)
})
it('uses a review that arrives after opening without losing an edited draft', async () => {
  const ui = render(<Reviews stop={s} />)
  fireEvent.change(screen.getByLabelText('comments'), { target: { value: 'my draft' } })
  db.reviews = [{ id: 'existing', stop_id: s.id, author_id: 'me', comments: 'server', rating: 2, return_choice: 'no', outcome: 'done' }]
  ui.rerender(<Reviews stop={s} />)
  fireEvent.blur(screen.getByLabelText('comments'))
  expect(db.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'existing', comments: 'my draft' }))
})
it('offline reviews cannot be edited', () => {
  db.editable = false
  render(<Reviews stop={s} />)
  expect(screen.queryByRole('button', { name: 'done' })).toBeNull()
  expect(screen.queryByLabelText('comments')).toBeNull()
})
