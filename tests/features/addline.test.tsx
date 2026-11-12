import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { trip, stop, place } from '../factories'
import type { Trip } from '../../src/lib/types'

const db = vi.hoisted(() => ({
  trips: [] as unknown[], stops: [] as unknown[], online: true,
  save: vi.fn((r: unknown) => Promise.resolve(r)),
  spots: vi.fn(() => Promise.resolve([] as unknown[])),
}))
vi.mock('../../src/lib/queries', () => ({
  useTrips: () => ({ data: db.trips }),
  useLinks: () => ({ data: [] }),
  useStops: () => ({ data: db.stops }),
  useSave: () => ({ mutateAsync: db.save, mutate: db.save, isPending: false }),
}))
vi.mock('../../src/lib/offline', () => ({ useCanEdit: () => db.online, useOnline: () => db.online }))
vi.mock('../../src/lib/photon', async (orig) => ({ ...(await orig<typeof import('../../src/lib/photon')>()), searchSpots: db.spots }))

import { AddLine } from '../../src/features/itinerary/AddLine'

const tk = () => trip({ id: 'tk', start_date: '2025-09-18', end_date: '2025-09-26', base: place({ lat: 35.68, lng: 139.76 }) })

function show(t: Trip, day: string | null = '2025-09-19') {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter><AddLine trip={t} day={day} /></MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  db.online = true
  db.save.mockClear()
  db.spots.mockReset().mockResolvedValue([])
  db.trips = [tk()]
  db.stops = [stop({ trip_id: 'tk', day: '2025-09-19', position: 4 }), stop({ trip_id: 'tk', day: '2025-09-20', position: 9 })]
})

const name = () => screen.getByRole('textbox', { name: 'add to fri 19 sept' })

it('a start, an end and a name, then enter, saves a line last on that day and empties for the next', async () => {
  show(tk())
  await userEvent.type(screen.getByLabelText('start time'), '13:00')
  await userEvent.type(screen.getByLabelText('end time'), '14:30')
  await userEvent.type(name(), 'cafe de pelgrim{Enter}')
  expect(db.save).toHaveBeenCalledWith(expect.objectContaining({
    trip_id: 'tk', kind: 'place', title: 'cafe de pelgrim', day: '2025-09-19', time: '13:00', end_time: '14:30',
    status: 'idea', saved: false, position: 5,
  }))
  expect(name()).toHaveValue('')
  expect(screen.getByLabelText('start time')).toHaveValue('')
  expect(screen.getByLabelText('start time')).toHaveFocus()
})

it('the time reads "any" until you type one, and "1pm" works', async () => {
  show(tk())
  expect(screen.getByLabelText('start time')).toHaveAttribute('placeholder', 'any')
  await userEvent.type(screen.getByLabelText('start time'), '1pm')
  await userEvent.type(name(), 'lunch')
  await userEvent.click(screen.getByRole('button', { name: 'add line' }))
  expect(db.save).toHaveBeenCalledWith(expect.objectContaining({ title: 'lunch', time: '13:00', end_time: null }))
})

it('letters that are not a time never go in, and a time reads as 13:00 once you leave it', async () => {
  show(tk())
  const start = screen.getByLabelText('start time')
  await userEvent.type(start, 'dsdsds')
  expect(start).toHaveValue('')
  await userEvent.type(start, '1pm')
  expect(start).toHaveValue('1pm')
  await userEvent.type(screen.getByLabelText('end time'), 'xx230p')
  expect(screen.getByLabelText('end time')).toHaveValue('230p')
  await userEvent.click(name())
  expect(start).toHaveValue('13:00')
  expect(screen.getByLabelText('end time')).toHaveValue('14:30')
})

it('a time it cannot read says so and saves nothing', async () => {
  show(tk())
  await userEvent.type(screen.getByLabelText('start time'), '25:00')
  await userEvent.type(name(), 'lunch{Enter}')
  expect(screen.getByText('check the time')).toHaveClass('warn-line')
  expect(db.save).not.toHaveBeenCalled()
})

it('a visible add button adds the line, like enter', async () => {
  show(tk())
  expect(screen.getByRole('button', { name: 'add line' })).toHaveTextContent('add')
  await userEvent.type(name(), 'kura sushi')
  await userEvent.click(screen.getByRole('button', { name: 'add line' }))
  expect(db.save).toHaveBeenCalledWith(expect.objectContaining({ title: 'kura sushi' }))
  expect(name()).toHaveValue('')
})

it('times are optional; an empty name saves nothing', async () => {
  show(tk())
  await userEvent.type(name(), '   {Enter}')
  expect(db.save).not.toHaveBeenCalled()
  await userEvent.type(name(), 'explore asakusa{Enter}')
  expect(db.save).toHaveBeenCalledWith(expect.objectContaining({ title: 'explore asakusa', time: null, end_time: null }))
})

it('an end before the start says so and saves nothing', async () => {
  show(tk())
  await userEvent.type(screen.getByLabelText('start time'), '15:00')
  await userEvent.type(screen.getByLabelText('end time'), '14:00')
  await userEvent.type(name(), 'museum{Enter}')
  expect(screen.getByText('end before start')).toHaveClass('warn-line')
  expect(db.save).not.toHaveBeenCalled()
  expect(name()).toHaveValue('museum')
})

it('with no date, it adds to "no date"', async () => {
  show(tk(), null)
  await userEvent.type(screen.getByRole('textbox', { name: 'add to no date' }), 'onsen{Enter}')
  expect(db.save).toHaveBeenCalledWith(expect.objectContaining({ day: null, title: 'onsen' }))
})

it('is gone offline', () => {
  db.online = false
  show(tk())
  expect(screen.queryByRole('textbox')).toBeNull()
})

it('reads its fields in order: start, then end once there is a start, then name', async () => {
  show(tk())
  expect(screen.queryByLabelText('end time')).toBeNull()
  await userEvent.type(screen.getByLabelText('start time'), '09:00')
  const row = screen.getByRole('group', { name: 'add to fri 19 sept' })
  expect(within(row).getAllByLabelText(/time|add to/).map((el) => el.getAttribute('aria-label'))).toEqual(['start time', 'end time', 'add to fri 19 sept'])
})

it('a line about getting around is saved as a journey with its mode, and no place is looked for', async () => {
  show(tk())
  await userEvent.type(name(), 'bus 9 to shijo omiya{Enter}')
  expect(db.save).toHaveBeenCalledWith(expect.objectContaining({ kind: 'journey', mode: 'bus', title: 'bus 9 to shijo omiya', place: null }))
  await new Promise((r) => setTimeout(r, 0))
  expect(db.spots).not.toHaveBeenCalled()
})

it('a walk is saved as a note, and a shop with "line" in its name is still a place', async () => {
  show(tk())
  await userEvent.type(name(), 'walk to dinner{Enter}')
  expect(db.save).toHaveBeenCalledWith(expect.objectContaining({ kind: 'note', title: 'walk to dinner' }))
  await userEvent.type(name(), 'line friends store{Enter}')
  expect(db.save).toHaveBeenCalledWith(expect.objectContaining({ kind: 'place', title: 'line friends store' }))
})

it('a line typed with a time also writes down the day\'s order, so it stays put if its time is cleared later', async () => {
  db.stops = [stop({ id: 'early', trip_id: 'tk', day: '2025-09-19', time: '09:00', position: 0 }), stop({ id: 'late', trip_id: 'tk', day: '2025-09-19', time: '18:00', position: 1 })]
  show(tk())
  await userEvent.type(screen.getByLabelText('start time'), '13:00')
  await userEvent.type(name(), 'lunch{Enter}')
  expect(db.save).toHaveBeenCalledWith({ id: 'late', position: 2 })
  expect(db.save).toHaveBeenCalledWith({ id: expect.any(String), position: 1 })
})
