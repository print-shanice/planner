import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { trip, stop } from '../factories'

const db = vi.hoisted(() => ({ trips: [] as any[], links: [] as any[], stops: [] as any[], save: vi.fn(), online: true, open: vi.fn() }))
vi.mock('../../src/lib/queries', () => ({
  useTrips: () => ({ data: db.trips }),
  useLinks: () => ({ data: db.links }),
  useStops: () => ({ data: db.stops }),
  useSave: () => ({ mutateAsync: db.save, mutate: db.save, isPending: false }),
}))
vi.mock('../../src/lib/offline', () => ({ useCanEdit: () => db.online, useOnline: () => db.online }))
vi.mock('../../src/features/stops/StopSheet', () => ({ useStopSheet: () => ({ openStop: db.open }) }))

import { NotesTab } from '../../src/features/notes/NotesTab'

const eu = trip({ id: 'eu', name: 'euro summer', start_date: '2027-06-01', end_date: '2027-06-30' })
const prg = trip({ id: 'prg', parent_id: 'eu', name: 'prague', start_date: '2027-06-05', end_date: '2027-06-08' })

beforeEach(() => {
  db.online = true
  db.trips = [eu, prg]
  db.links = [{ id: 'l1', trip_id: 'eu', url: 'https://blog.example/prague', title: 'prague blog', note: 'read on the train', created_at: '2026-11-01' }]
  db.stops = [
    stop({ id: 'n1', trip_id: 'eu', kind: 'note', title: 'things to ask the landlord', day: null }),
    stop({ id: 'f1', trip_id: 'prg', kind: 'journey', mode: 'flight', title: 'ams to prg', day: '2027-06-05', time: '07:10', notes: 'bring the visa printout' }),
    stop({ id: 'h1', trip_id: 'prg', kind: 'stay', title: 'hotel u zlatého', day: '2027-06-05', end_date: '2027-06-08', notes: 'late check-in, call ahead' }),
    stop({ id: 'p1', trip_id: 'eu', kind: 'place', title: 'no notes here', day: '2027-06-02' }),
  ]
  db.save.mockReset().mockResolvedValue({}); db.open.mockReset()
})

const show = () => render(<MemoryRouter><NotesTab trip={eu} /></MemoryRouter>)

it('follows the trip: no date first, then each day, each note saying what it is on', () => {
  show()
  const groups = screen.getAllByRole('list').map((l) => l.getAttribute('aria-label'))
  expect(groups).toEqual(['no date', 'sat 5 jun'])
  const undated = within(screen.getByRole('list', { name: 'no date' }))
  expect(undated.getByText('things to ask the landlord')).toBeInTheDocument()
  expect(undated.getByText('read on the train')).toBeInTheDocument()
  const day = within(screen.getByRole('list', { name: 'sat 5 jun' }))
  expect(day.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
    expect.stringMatching(/ams to prg.*bring the visa printout/),
    expect.stringMatching(/hotel u zlatého.*late check-in, call ahead/),
  ])
  expect(screen.queryByText('no notes here')).toBeNull()
})

it('a day inside a side trip says which', () => {
  show()
  expect(screen.getByRole('heading', { name: /sat 5 jun/ })).toHaveTextContent('prague')
})

it('search keeps only the notes that match, and marks the words', async () => {
  show()
  await userEvent.type(screen.getByRole('searchbox', { name: 'search notes' }), 'visa')
  expect(screen.getByText('visa').tagName).toBe('MARK')
  expect(screen.queryByText('things to ask the landlord')).toBeNull()
  expect(screen.queryByText(/late check-in/)).toBeNull()
  expect(screen.queryByRole('list', { name: 'no date' })).toBeNull()
})

it('nothing matching says so', async () => {
  show()
  await userEvent.type(screen.getByRole('searchbox', { name: 'search notes' }), 'zzz')
  expect(screen.getByText('nothing found')).toBeInTheDocument()
})

it('no notes yet', () => {
  db.stops = []; db.links = []
  show()
  expect(screen.getByText('no notes yet')).toBeInTheDocument()
})

it('jotting makes an undated note', async () => {
  show()
  await userEvent.type(screen.getByRole('textbox', { name: 'jot a note' }), 'gift for mum{Enter}')
  expect(db.save).toHaveBeenCalledWith(expect.objectContaining({ trip_id: 'eu', kind: 'note', title: 'gift for mum', day: null }))
})

it('tapping a note opens the card it belongs to', async () => {
  show()
  await userEvent.click(screen.getByRole('button', { name: /hotel u zlatého/ }))
  expect(db.open).toHaveBeenCalledWith('h1', '2027-06-05')
})

it('a link note opens the link', () => {
  show()
  expect(screen.getByRole('link', { name: /prague blog/ })).toHaveAttribute('href', 'https://blog.example/prague')
})

it('offline there is nothing to jot into', () => {
  db.online = false
  show()
  expect(screen.queryByRole('textbox', { name: 'jot a note' })).toBeNull()
})
