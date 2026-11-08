import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { trip, stop, place } from '../factories'
import type { Trip } from '../../src/lib/types'

const db = vi.hoisted(() => ({ trips: [] as unknown[], stops: [] as unknown[], files: [] as unknown[], open: vi.fn(), remove: vi.fn(), save: vi.fn((r: unknown) => Promise.resolve(r)) }))
vi.mock('../../src/lib/queries', () => ({
  useTrips: () => ({ data: db.trips }),
  useStops: () => ({ data: db.stops }),
  useFiles: () => ({ data: db.files }),
  useSave: () => ({ mutateAsync: db.save, mutate: db.save, isPending: false }),
}))
vi.mock('../../src/lib/undo', () => ({ useUndoRemove: () => db.remove }))
vi.mock('../../src/lib/offline', () => ({ useCanEdit: () => true, useOnline: () => true }))
vi.mock('../../src/lib/photon', async (orig) => ({ ...(await orig<typeof import('../../src/lib/photon')>()), searchSpots: () => Promise.resolve([]) }))
vi.mock('../../src/features/stops/StopSheet', () => ({ useStopSheet: () => ({ openStop: db.open }) }))

import { ItineraryTab } from '../../src/features/itinerary/ItineraryTab'
import { ReadingDayProvider, useReadingDay } from '../../src/features/trip/readingDay'

function Probe() {
  const l = useLocation()
  const reading = useReadingDay()
  return <><output data-testid="loc">{l.search}</output><output data-testid="reading">{reading.day ?? ''}</output></>
}
// the day being read: the map and the + follow it, the link (and so the calendar) doesn't
const day = () => screen.getByTestId('reading').textContent
const linkDay = () => new URLSearchParams(screen.getByTestId('loc').textContent ?? '').get('day')

const tokyo = () => trip({ id: 'tk', name: 'tokyo', start_date: '2025-09-18', end_date: '2025-09-20' })

function show(t: Trip, path = '/trip/tk?tab=itinerary') {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path="/trip/:id" element={<ReadingDayProvider><ItineraryTab trip={t} /><Probe /></ReadingDayProvider>} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const dayBox = (date: string) => within(screen.getByTestId(`itin-${date}`))
const head = (name: RegExp) => within(screen.getByRole('heading', { level: 3, name })).getByRole('button')

beforeEach(() => {
  localStorage.clear()
  Element.prototype.scrollIntoView = vi.fn()
  db.open.mockReset()
  db.save.mockClear()
  db.remove.mockClear()
  db.files = []
  const t = tokyo()
  db.trips = [t]
  db.stops = [
    stop({ id: 'leave', trip_id: 'tk', day: '2025-09-18', time: '22:00', title: 'grab to changi' }),
    stop({ id: 'narita', trip_id: 'tk', day: '2025-09-19', time: '09:00', title: 'narita airport t2', place: place({ city: 'narita' }) }),
    stop({ id: 'iyoshi', trip_id: 'tk', day: '2025-09-19', title: 'Iyoshi Cola', category: 'cafe', place: place({ area: 'shibuya', city: 'tokyo' }) }),
    stop({ id: 'hair', trip_id: 'tk', day: '2025-09-19', time: '17:00', end_time: '18:30', title: 'cut hair at assort', place: place({ area: 'harajuku', city: 'tokyo' }) }),
    stop({ id: 'neel', trip_id: 'tk', day: '2025-09-20', time: '09:00', title: 'neel' }),
    stop({ id: 'cola2', trip_id: 'tk', day: '2025-09-20', title: 'iyoshi cola again' }),
    stop({ id: 'enji', trip_id: 'tk', day: '2025-09-20', time: '19:00', title: 'enji', kind: 'note', notes: 'reservation: shanice\nMVE5DHSCL6' }),
  ]
})

it('shows every day as a heading with its date, areas and count, then its lines with times', () => {
  show(tokyo())
  const h = head(/fri 19 sep/)
  expect(h).toHaveAttribute('aria-expanded', 'true')
  expect(h).toHaveTextContent('narita · harajuku · shibuya')
  // no count on the heading
  expect(h).not.toHaveTextContent(/\d$/)
  const lines = dayBox('2025-09-19').getAllByTestId('itin-line')
  // a live line's time is in its boxes; an empty start reads "any"
  const shown = (l: HTMLElement) => {
    const [from, till] = [...l.querySelectorAll<HTMLInputElement>('.itin-time input')]
    return from ? (from.value || from.placeholder) + (till?.value ? `–${till.value}` : '') : l.querySelector('.itin-time')?.textContent
  }
  expect(lines.map(shown)).toEqual(['09:00', '17:00–18:30', 'any'])
  expect(lines[2]).toHaveTextContent('cafe · tokyo')
  expect(screen.getAllByRole('heading', { level: 3 }).map((x) => x.textContent?.slice(0, 10))).toEqual(['thu 18 sep', 'fri 19 sep', 'sat 20 sep'])
})

it('a heading folds its day, and the fold is remembered on this device', async () => {
  const { unmount } = show(tokyo())
  await userEvent.click(head(/fri 19 sep/))
  expect(head(/fri 19 sep/)).toHaveAttribute('aria-expanded', 'false')
  expect(dayBox('2025-09-19').queryAllByTestId('itin-line')).toHaveLength(0)
  unmount()
  show(tokyo())
  expect(head(/fri 19 sep/)).toHaveAttribute('aria-expanded', 'false')
})

it('search finds every line, marks it, and steps through them, folding days with nothing', async () => {
  show(tokyo())
  await userEvent.click(head(/thu 18 sep/))
  const box = screen.getByRole('searchbox', { name: 'search the itinerary' })
  await userEvent.type(box, 'IYOSHI')
  expect(screen.getByTestId('match-count')).toHaveTextContent('1 of 2')
  expect(head(/thu 18 sep/)).toHaveAttribute('aria-expanded', 'false')
  expect(head(/fri 19 sep/)).toHaveAttribute('aria-expanded', 'true')
  expect(document.querySelector('[data-line="iyoshi"]')).toHaveClass('current')
  expect(document.querySelector('[data-line="iyoshi"] mark')).toHaveTextContent('Iyoshi')
  expect(day()).toBe('2025-09-19')
  await userEvent.type(box, '{Enter}')
  expect(screen.getByTestId('match-count')).toHaveTextContent('2 of 2')
  expect(document.querySelector('[data-line="cola2"]')).toHaveClass('current')
  expect(day()).toBe('2025-09-20')
  await userEvent.click(screen.getByRole('button', { name: 'next match' }))
  expect(screen.getByTestId('match-count')).toHaveTextContent('1 of 2')
  await userEvent.click(screen.getByRole('button', { name: 'previous match' }))
  expect(screen.getByTestId('match-count')).toHaveTextContent('2 of 2')
  // the strip marks the days with a match
  const strip = within(screen.getByRole('navigation', { name: 'days' }))
  expect(strip.getByRole('button', { name: /19 sep/ })).toHaveClass('hit')
  expect(strip.getByRole('button', { name: /18 sep/ })).not.toHaveClass('hit')
  // clearing puts the folds back the way they were
  await userEvent.clear(box)
  expect(head(/thu 18 sep/)).toHaveAttribute('aria-expanded', 'false')
  expect(head(/sat 20 sep/)).toHaveAttribute('aria-expanded', 'true')
  expect(screen.queryByTestId('match-count')).toBeNull()
})

it('a match in the notes shows that bit of the notes; no match says 0', async () => {
  show(tokyo())
  const box = screen.getByRole('searchbox', { name: 'search the itinerary' })
  await userEvent.type(box, 'mve5')
  expect(screen.getByTestId('match-count')).toHaveTextContent('1 of 1')
  expect(document.querySelector('[data-line="enji"] .itin-snippet mark')).toHaveTextContent('MVE5')
  await userEvent.clear(box)
  await userEvent.type(box, 'zzz')
  expect(screen.getByTestId('match-count')).toHaveTextContent(/^0$/)
  expect(screen.queryByRole('button', { name: 'next match' })).toBeDisabled()
})

it('tapping a folded day in the strip opens it', async () => {
  show(tokyo())
  await userEvent.click(head(/sat 20 sep/))
  expect(head(/sat 20 sep/)).toHaveAttribute('aria-expanded', 'false')
  await userEvent.click(within(screen.getByRole('navigation', { name: 'days' })).getByRole('button', { name: /20 sep/ }))
  expect(head(/sat 20 sep/)).toHaveAttribute('aria-expanded', 'true')
})

it('the day strip jumps to a day and makes it the day you are reading, leaving the link alone', async () => {
  show(tokyo())
  await userEvent.click(within(screen.getByRole('navigation', { name: 'days' })).getByRole('button', { name: /20 sep/ }))
  expect(day()).toBe('2025-09-20')
  expect(linkDay()).toBeNull()
  expect(within(screen.getByRole('navigation', { name: 'days' })).getByRole('button', { name: /20 sep/ })).toHaveAttribute('aria-current', 'true')
  expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
})

it('the › on a line opens its card', async () => {
  show(tokyo())
  await userEvent.click(screen.getByRole('button', { name: 'open neel' }))
  expect(db.open).toHaveBeenCalledWith('neel', '2025-09-20')
})

it('a line is live text: type over its name, enter saves only what changed and moves to the next line', async () => {
  show(tokyo())
  const name = screen.getByRole('textbox', { name: 'change neel' })
  expect(name).toHaveValue('neel')
  await userEvent.clear(name)
  await userEvent.type(name, 'neel coffee{Enter}')
  expect(db.save).toHaveBeenCalledWith({ id: 'neel', title: 'neel coffee' })
  expect(screen.getByRole('textbox', { name: 'change enji' })).toHaveFocus()
})

it('a changed line shows a save button, then says saving and saved', async () => {
  let land!: () => void
  db.save.mockImplementationOnce(() => new Promise<unknown>((r) => { land = () => r({}) }))
  show(tokyo())
  expect(screen.queryByRole('button', { name: 'save neel' })).toBeNull()
  await userEvent.type(screen.getByRole('textbox', { name: 'change neel' }), ' cafe')
  await userEvent.click(screen.getByRole('button', { name: 'save neel' }))
  expect(db.save).toHaveBeenCalledWith({ id: 'neel', title: 'neel cafe' })
  const line = () => within(document.querySelector('[data-line="neel"]') as HTMLElement)
  expect(line().getByRole('status')).toHaveTextContent('saving')
  await act(async () => { land() })
  expect(line().getByRole('status')).toHaveTextContent('saved')
  expect(screen.queryByRole('button', { name: 'save neel' })).toBeNull()
})

it('a time typed over saves when you leave the line', async () => {
  show(tokyo())
  const start = screen.getByRole('textbox', { name: 'start time of narita airport t2' })
  expect(start).toHaveValue('09:00')
  await userEvent.clear(start)
  await userEvent.type(start, '10')
  expect(db.save).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('textbox', { name: 'change neel' }))
  expect(start).toHaveValue('10:00')
  expect(db.save).toHaveBeenCalledWith({ id: 'narita', time: '10:00' })
  expect(db.save).toHaveBeenCalledTimes(1)
})

it('leaving a line untouched saves nothing; escape puts it back', async () => {
  show(tokyo())
  const name = screen.getByRole('textbox', { name: 'change neel' })
  await userEvent.click(name)
  await userEvent.type(name, ' later')
  await userEvent.keyboard('{Escape}')
  expect(name).toHaveValue('neel')
  await userEvent.click(screen.getByRole('textbox', { name: 'change enji' }))
  expect(db.save).not.toHaveBeenCalled()
})

it('emptying a line removes it, with undo; one with tickets just goes back', async () => {
  show(tokyo())
  await userEvent.clear(screen.getByRole('textbox', { name: 'change neel' }))
  await userEvent.keyboard('{Enter}')
  expect(db.remove).toHaveBeenCalledWith('neel')
  db.files = [{ id: 'f', stop_id: 'enji', path: 'x' }]
  const enji = screen.getByRole('textbox', { name: 'change enji' })
  await userEvent.clear(enji)
  await userEvent.keyboard('{Enter}')
  expect(db.remove).toHaveBeenCalledTimes(1)
  expect(enji).toHaveValue('enji')
})

it('journeys and stays stay tap-to-open', async () => {
  db.stops = [stop({ id: 'fl', trip_id: 'tk', kind: 'journey', day: '2025-09-18', time: '22:00', title: 'sq 638', origin: place({ name: 'changi' }), destination: place({ name: 'narita' }) })]
  show(tokyo())
  expect(screen.queryByRole('textbox', { name: /change changi/ })).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: /changi → narita/ }))
  expect(db.open).toHaveBeenCalledWith('fl', '2025-09-18')
})

it('every open day ends with a line to type into', async () => {
  show(tokyo())
  expect(dayBox('2025-09-19').getByRole('group', { name: 'add to fri 19 sept' })).toBeInTheDocument()
  await userEvent.click(head(/fri 19 sep/))
  expect(screen.queryByRole('group', { name: 'add to fri 19 sept' })).toBeNull()
})

it("a side trip's days sit in place, headed with its name; saved ideas stay out; undated stops go last", () => {
  const eu = trip({ id: 'eu', name: 'exchange', start_date: '2027-02-18', end_date: '2027-02-24' })
  const paris = trip({ id: 'paris', parent_id: 'eu', name: 'paris', start_date: '2027-02-20', end_date: '2027-02-21', color: 2 })
  db.trips = [eu, paris]
  db.stops = [
    stop({ id: 'louvre', trip_id: 'paris', day: '2027-02-20', title: 'louvre' }),
    stop({ id: 'idea', trip_id: 'eu', day: null, saved: true, title: 'maybe a museum' }),
    stop({ id: 'loose', trip_id: 'eu', day: null, title: 'onsen someday' }),
  ]
  show(eu, '/trip/eu?tab=itinerary')
  expect(head(/sat 20 feb/)).toHaveTextContent('paris')
  expect(head(/thu 18 feb/)).not.toHaveTextContent('paris')
  expect(screen.queryByText('maybe a museum')).toBeNull()
  expect(within(screen.getByRole('region', { name: 'no date' })).getByDisplayValue('onsen someday')).toBeInTheDocument()
})

it("a line typed on a side trip's day goes to the side trip", async () => {
  const eu = trip({ id: 'eu', name: 'exchange', start_date: '2027-02-18', end_date: '2027-02-24' })
  const paris = trip({ id: 'paris', parent_id: 'eu', name: 'paris', start_date: '2027-02-20', end_date: '2027-02-21', color: 2 })
  db.trips = [eu, paris]
  db.stops = []
  show(eu, '/trip/eu?tab=itinerary')
  await userEvent.type(screen.getByRole('textbox', { name: 'add to sat 20 feb' }), 'louvre{Enter}')
  expect(db.save).toHaveBeenCalledWith(expect.objectContaining({ trip_id: 'paris', day: '2027-02-20', title: 'louvre' }))
})
