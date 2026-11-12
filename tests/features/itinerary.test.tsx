import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { trip, stop, place } from '../factories'
import type { Trip } from '../../src/lib/types'

const db = vi.hoisted(() => ({ trips: [] as unknown[], stops: [] as unknown[], files: [] as unknown[], links: [] as unknown[], costs: [] as unknown[], open: vi.fn(), remove: vi.fn(), save: vi.fn((r: unknown) => Promise.resolve(r)) }))
vi.mock('../../src/lib/queries', () => ({
  useTrips: () => ({ data: db.trips }),
  useLinks: () => ({ data: db.links }),
  useCosts: () => ({ data: db.costs }),
  useStops: () => ({ data: db.stops }),
  useFiles: () => ({ data: db.files }),
  useRates: () => ({ data: null }),
  useMembers: () => ({ data: [] }),
  useRemove: () => ({ mutateAsync: vi.fn(), mutate: vi.fn() }),
  useSave: () => ({ mutateAsync: db.save, mutate: db.save, isPending: false }),
}))
vi.mock('../../src/lib/undo', () => ({ useUndoRemove: () => db.remove }))
vi.mock('../../src/lib/offline', () => ({ useCanEdit: () => true, useOnline: () => true }))
vi.mock('../../src/lib/photon', async (orig) => ({ ...(await orig<typeof import('../../src/lib/photon')>()), searchSpots: () => Promise.resolve([]) }))
vi.mock('../../src/features/stops/StopSheet', () => ({ useStopSheet: () => ({ openStop: db.open, editStop: db.open }) }))

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

function show(t: Trip, path = '/trip/tk?tab=itinerary', edit = true) {
  window.matchMedia = ((q: string) => ({ matches: edit && q.includes('1024'), media: q, addEventListener() {}, removeEventListener() {} })) as never
  const result = render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path="/trip/:id" element={<ReadingDayProvider><ItineraryTab trip={t} /><Probe /></ReadingDayProvider>} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return result
}

const dayBox = (date: string) => within(screen.getByTestId(`itin-${date}`))
const head = (name: RegExp) => screen.getByRole('heading', { level: 2, name })
const meta = (date: string) => dayBox(date).getByText((_, el) => !!el?.classList.contains('doc-day-meta'))
const strip = () => within(screen.getByRole('navigation', { name: 'days' }))
async function search(text: string) {
  if (!screen.queryByRole('searchbox', { name: 'search the plan' })) await userEvent.click(screen.getByRole('button', { name: 'search the plan' }))
  const box = screen.getByRole('searchbox', { name: 'search the plan' })
  await userEvent.type(box, text)
  return box
}

beforeEach(() => {
  localStorage.clear()
  Element.prototype.scrollIntoView = vi.fn()
  db.open.mockReset()
  db.save.mockClear()
  db.remove.mockClear()
  db.files = []
  db.links = []
  db.costs = []
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

it('shows every day open, headed by its date with its areas, then its lines with times and kinds', () => {
  show(tokyo())
  expect(head(/friday 19 september/)).toBeInTheDocument()
  expect(meta('2025-09-19')).toHaveTextContent('narita')
  expect(meta('2025-09-19')).toHaveTextContent('harajuku')
  expect(screen.queryAllByRole('button', { expanded: false }).filter((b) => !b.classList.contains('marker-btn'))).toHaveLength(0)
  const lines = dayBox('2025-09-19').getAllByTestId('itin-line')
  // a live line's time is in its boxes; an empty start reads "any"
  const shown = (l: HTMLElement) => {
    const [from, till] = [...l.querySelectorAll<HTMLInputElement>('.itin-time input')]
    return from ? (from.value || from.placeholder) + (till?.value ? `–${till.value}` : '') : l.querySelector('.itin-time')?.textContent
  }
  expect(lines.map(shown)).toEqual(['09:00', '17:00–18:30', 'any'])
  expect(lines[2]).toHaveTextContent('cafe · tokyo')
  // numbered as on the map; what kind of place it is reads in words under the name
  expect([...lines].map((l) => l.querySelector('.seq')?.textContent)).toEqual(['01', '02', '03'])
  expect(screen.getAllByRole('heading', { level: 2 }).map((x) => x.textContent)).toEqual(['thursday 18 september', 'friday 19 september', 'saturday 20 september'])
})

it('a number means a pin: lines with no spot on the map, and getting around, have none', () => {
  db.stops = [...(db.stops as ReturnType<typeof stop>[]),
    stop({ id: 'tozai', trip_id: 'tk', day: '2025-09-20', time: '11:40', kind: 'journey', mode: 'train', title: 'tozai line to nakano', position: 1 }),
    stop({ id: 'kyle', trip_id: 'tk', day: '2025-09-20', time: '12:00', title: "kyle's good finds", place: place(), position: 2 }),
  ]
  show(tokyo())
  const lines = dayBox('2025-09-20').getAllByTestId('itin-line')
  expect(lines.map((l) => l.querySelector('.seq')?.textContent ?? '')).toEqual(['', '', '', '01', ''])
  // a typed train line is plain text you type over, like a place or a note; its time isn't said twice
  expect(screen.getByRole('textbox', { name: 'change tozai line to nakano' })).toBeInTheDocument()
  expect(document.querySelector('[data-line="tozai"] .itin-sub')).toBeNull()
})

it('nothing folds: there are no day toggles to open', () => {
  show(tokyo())
  expect(document.querySelectorAll('[aria-expanded]:not(.marker-btn)')).toHaveLength(0)
  for (const d of ['2025-09-18', '2025-09-19', '2025-09-20']) expect(dayBox(d).getAllByTestId('itin-line').length).toBeGreaterThan(0)
})

it('search opens from the strip, finds every line, marks it and steps through, hiding days with nothing', async () => {
  show(tokyo())
  const box = await search('IYOSHI')
  expect(screen.getByTestId('match-count')).toHaveTextContent('1 of 2')
  expect(document.querySelectorAll('#itin-2025-09-18 [data-testid="itin-line"]')).toHaveLength(0)
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
  await userEvent.click(screen.getByRole('button', { name: 'done' }))
  expect(screen.queryByRole('searchbox')).toBeNull()
  expect(dayBox('2025-09-18').getAllByTestId('itin-line')).toHaveLength(1)
})

it('a match in the notes shows that bit of the notes; no match says 0', async () => {
  show(tokyo())
  const box = await search('mve5')
  expect(screen.getByTestId('match-count')).toHaveTextContent('1 of 1')
  expect(document.querySelector('[data-line="enji"] .itin-snippet mark')).toHaveTextContent('MVE5')
  await userEvent.clear(box)
  await userEvent.type(box, 'zzz')
  expect(screen.getByTestId('match-count')).toHaveTextContent(/^0$/)
  expect(screen.queryByRole('button', { name: 'next match' })).toBeDisabled()
})

it('the day strip jumps to a day and makes it the day you are reading, leaving the link alone', async () => {
  show(tokyo())
  await userEvent.click(strip().getByRole('button', { name: /20 september/ }))
  expect(day()).toBe('2025-09-20')
  expect(linkDay()).toBeNull()
  expect(strip().getByRole('button', { name: /20 september/ })).toHaveAttribute('aria-current', 'true')
  expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
})

it('the strip names the month where it starts', () => {
  show(tokyo())
  expect(screen.getByRole('navigation', { name: 'days' })).toHaveTextContent(/^sep/)
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
  expect(db.save.mock.calls.filter(([r]) => 'time' in (r as object))).toHaveLength(1)
})

it('a changed time also stores the order the day now reads in, so the line stays put if the time is cleared later', async () => {
  db.stops = (db.stops as ReturnType<typeof stop>[]).map((s, i) => ({ ...s, position: i }))
  show(tokyo())
  const start = screen.getByRole('textbox', { name: 'start time of narita airport t2' })
  await userEvent.clear(start)
  await userEvent.type(start, '18')
  await userEvent.click(screen.getByRole('textbox', { name: 'change neel' }))
  expect(db.save).toHaveBeenCalledWith({ id: 'narita', time: '18:00' })
  // 19 sep now reads: 17:00 hair, then 18:00 narita with iyoshi cola (untimed) still under it
  expect(db.save).toHaveBeenCalledWith({ id: 'hair', position: 0 })
  expect(db.save).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'iyoshi' }))
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
  expect(db.remove).toHaveBeenCalledWith('neel', 'neel')
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
  await userEvent.click(screen.getByRole('button', { name: /^sq 638 changi → narita|changi → narita.*sq 638/ }))
  expect(db.open).toHaveBeenCalledWith('fl', '2025-09-18')
})

it('every day ends with a line to type into, on a phone too', async () => {
  show(tokyo(), undefined, false)
  expect(dayBox('2025-09-19').getByRole('group', { name: 'add to fri 19 sept' })).toBeInTheDocument()
})

it('between located lines, the walk is a link to google maps directions', () => {
  db.stops = [
    stop({ id: 'a', trip_id: 'tk', day: '2025-09-19', time: '09:00', title: 'a', place: place({ lat: 35.66, lng: 139.70 }) }),
    stop({ id: 'b', trip_id: 'tk', day: '2025-09-19', time: '10:00', title: 'b', place: place({ lat: 35.67, lng: 139.71 }) }),
  ]
  show(tokyo())
  const walk = dayBox('2025-09-19').getByRole('link', { name: /directions|walk/ })
  expect(walk.getAttribute('href')).toContain('google.com/maps/dir/')
})

it('every line moves with alt and the arrow keys, timed or not, with no handle to press', async () => {
  db.stops = [
    stop({ id: 'a', trip_id: 'tk', day: '2025-09-19', time: '09:00', title: 'timed', position: 0 }),
    stop({ id: 'b', trip_id: 'tk', day: '2025-09-19', title: 'second', position: 1 }),
    stop({ id: 'c', trip_id: 'tk', day: '2025-09-19', time: '12:00', title: 'noon', position: 2 }),
    stop({ id: 'd', trip_id: 'tk', day: '2025-09-20', time: '10:00', title: 'next day', position: 0 }),
  ]
  show(tokyo(), undefined, false)
  expect(screen.queryByRole('button', { name: /^move / })).toBeNull()
  screen.getByRole('button', { name: /^second/ }).focus()
  await userEvent.keyboard('{ArrowDown}')
  expect(db.save).not.toHaveBeenCalled()
  await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}')
  // under "noon" now, so it goes with it
  expect(db.save).toHaveBeenCalledWith({ id: 'c', position: 1 })
  expect(db.save).toHaveBeenCalledWith({ id: 'b', position: 2 })
  db.save.mockClear()
  screen.getByRole('button', { name: /^noon/ }).focus()
  await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}')
  // past the end of its day it goes into the next one, on top; 12:00 above 10:00 doesn't fit, so the time clears
  expect(db.save).toHaveBeenCalledWith({ id: 'c', day: '2025-09-20', time: null, position: 0 })
})

it('on a laptop, alt and the arrows move the line whose name you are typing in', async () => {
  db.stops = [
    stop({ id: 'p', trip_id: 'tk', day: '2025-09-19', title: 'first', position: 0 }),
    stop({ id: 'q', trip_id: 'tk', day: '2025-09-19', title: 'second', position: 1 }),
  ]
  show(tokyo())
  await userEvent.click(screen.getByRole('textbox', { name: 'change second' }))
  await userEvent.keyboard('{Alt>}{ArrowUp}{/Alt}')
  expect(db.save).toHaveBeenCalledWith({ id: 'q', position: 0 })
  expect(db.save).toHaveBeenCalledWith({ id: 'p', position: 1 })
})

it('a line with tickets says so', () => {
  db.files = [{ id: 'f', stop_id: 'neel', path: 'x', name: 'x.pdf', mime: 'application/pdf' }]
  show(tokyo())
  expect(within(document.querySelector('[data-line="neel"]') as HTMLElement).getByText('1 ticket')).toBeInTheDocument()
})

it('a line shows what it holds: its note, booking ref, cost and tickets, and they open its card', async () => {
  db.stops = [stop({ id: 'nomad', trip_id: 'tk', day: '2025-09-19', title: 'nomad coffee', ref: 'MVE5DH', notes: 'ask for the window table\nsecond line' })]
  db.files = [{ id: 'f', stop_id: 'nomad', path: 'x', name: 'x.pdf', mime: 'application/pdf' }, { id: 'g', stop_id: 'nomad', path: 'y', name: 'y.pdf', mime: 'application/pdf' }]
  db.costs = [{ id: 'c', trip_id: 'tk', stop_id: 'nomad', title: '', amount: 12, currency: 'EUR', status: 'paid', category: 'food' }]
  show(tokyo())
  const line = within(document.querySelector('[data-line="nomad"]') as HTMLElement)
  expect(line.getByText('ask for the window table')).toBeInTheDocument()
  expect(line.queryByText(/second line/)).toBeNull()
  expect(line.getByText('MVE5DH')).toHaveClass('keep-case')
  expect(line.getByText('2 tickets')).toBeInTheDocument()
  expect(line.getByText('€12')).toBeInTheDocument()
  await userEvent.click(line.getByRole('button', { name: 'details of nomad coffee' }))
  expect(db.open).toHaveBeenCalledWith('nomad', '2025-09-19')
})

it("a flight's line shows its terminal and gate", () => {
  const end = (o: object) => ({ iata: 'BCN', airport: 'El Prat', city: 'Barcelona', country: 'ES', lat: 41.3, lng: 2.08,
    scheduled: '2025-09-19 07:20+02:00', revised: null, terminal: '1', gate: 'B22', desk: null, belt: null, ...o })
  db.stops = [stop({ id: 'fly', trip_id: 'tk', day: '2025-09-19', time: '07:20', kind: 'journey', mode: 'flight', title: 'VY 1001',
    origin: place({ name: 'El Prat' }), destination: place({ name: 'Haneda' }),
    flight: { number: 'VY 1001', airline: 'Vueling', status: 'Expected', live: true, checked_at: '', dep: end({}), arr: end({ terminal: '3', gate: null }) } })]
  show(tokyo())
  const line = within(document.querySelector('[data-line="fly"]') as HTMLElement)
  expect(line.getByText('t1 · gate b22')).toBeInTheDocument()
})

it('a bare line has no details row', () => {
  show(tokyo())
  expect(within(document.querySelector('[data-line="neel"]') as HTMLElement).queryByRole('button', { name: /details of/ })).toBeNull()
})

it("a line's link is a small icon to the right of its name, never a pill", () => {
  db.stops = [stop({ id: 'boq', trip_id: 'tk', day: '2025-09-19', title: 'la boqueria' })]
  db.links = [{ id: 'l', trip_id: 'tk', stop_id: 'boq', url: 'https://instagram.com/reel/1', title: 'food finds', note: '' }]
  show(tokyo())
  const link = within(document.querySelector('[data-line="boq"]') as HTMLElement).getByRole('link', { name: 'open food finds' })
  expect(link).toHaveAttribute('href', 'https://instagram.com/reel/1')
  expect(link).toHaveAttribute('target', '_blank')
  expect(link.textContent).toBe('')
})

it("a side trip's days sit in place, headed with its name; nothing undated is in the plan", () => {
  const eu = trip({ id: 'eu', name: 'exchange', start_date: '2027-02-18', end_date: '2027-02-24' })
  const paris = trip({ id: 'paris', parent_id: 'eu', name: 'paris', start_date: '2027-02-20', end_date: '2027-02-21', color: 2 })
  db.trips = [eu, paris]
  db.stops = [
    stop({ id: 'louvre', trip_id: 'paris', day: '2027-02-20', title: 'louvre' }),
    stop({ id: 'idea', trip_id: 'eu', day: null, saved: true, title: 'maybe a museum' }),
    stop({ id: 'loose', trip_id: 'eu', day: null, title: 'onsen someday' }),
  ]
  show(eu, '/trip/eu?tab=itinerary')
  expect(meta('2027-02-20')).toHaveTextContent('paris')
  expect(screen.getByTestId('itin-2027-02-18').querySelector('.doc-day-head')).not.toHaveTextContent('paris')
  expect(screen.queryByText('maybe a museum')).toBeNull()
  expect(screen.queryByDisplayValue('onsen someday')).toBeNull()
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

it('phone reading opens activity details without entering edit mode', async () => {
  show(tokyo(), undefined, false)
  expect(screen.queryByRole('textbox', { name: 'change narita airport t2' })).toBeNull()
  await userEvent.click(dayBox('2025-09-19').getByRole('button', { name: /^narita airport t2/ }))
  expect(db.open).toHaveBeenCalledWith('narita', '2025-09-19')
})

it('scrolling Whole trip tracks the visible day after the header scrolls away', async () => {
  const bar = document.createElement('div'); bar.className = 'trip-bar'
  bar.getBoundingClientRect = () => ({ bottom: -400, height: 130 } as DOMRect)
  document.body.appendChild(bar)
  try {
    show(tokyo(), undefined, false)
    const dates = ['2025-09-18', '2025-09-19', '2025-09-20']
    dates.forEach((date, index) => {
      screen.getByTestId(`itin-${date}`).getBoundingClientRect = () => ({ top: [-300, 5, 500][index] } as DOMRect)
    })
    fireEvent.scroll(window)
    await vi.waitFor(() => expect(day()).toBe('2025-09-19'))
  } finally { bar.remove() }
})

it('keeps the reading day visible when the viewport changes its scroll container', async () => {
  let isWide = false
  const listeners = new Set<() => void>()
  window.matchMedia = ((q: string) => ({ matches: isWide && q.includes('1024'), media: q,
    addEventListener: (_: string, cb: () => void) => listeners.add(cb), removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
  })) as never
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><ReadingDayProvider><ItineraryTab trip={tokyo()} /><Probe /></ReadingDayProvider></MemoryRouter></QueryClientProvider>)
  await userEvent.click(within(screen.getByRole('navigation', { name: 'days' })).getByRole('button', { name: /19 september/ }))
  const scroll = vi.fn()
  screen.getByTestId('itin-2025-09-19').scrollIntoView = scroll
  act(() => { isWide = true; for (const cb of [...listeners]) cb() })
  await vi.waitFor(() => expect(scroll).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' }))
  expect(day()).toBe('2025-09-19')
})

it('side trips whose dates overlap say so in words, with a way to change them', async () => {
  const eu = trip({ id: 'eu', name: 'euro summer', start_date: '2027-06-01', end_date: '2027-07-01' })
  db.trips = [eu, trip({ id: 'rome', parent_id: 'eu', name: 'rome', start_date: '2027-06-12', end_date: '2027-06-16' }), trip({ id: 'flo', parent_id: 'eu', name: 'florence', start_date: '2027-06-14', end_date: '2027-06-18' })]
  db.stops = []
  show(eu, '/trip/eu')
  expect(screen.getByText('dates clash')).toBeInTheDocument()
  expect(screen.getByText(/rome and florence/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'adjust dates' }))
  expect(screen.getByRole('dialog', { name: 'edit trip' })).toBeInTheDocument()
})

describe('a long trip with side trips', () => {
  const eu = () => trip({ id: 'eu', name: 'exchange', start_date: '2027-01-28', end_date: '2027-07-13' })
  beforeEach(() => {
    db.trips = [eu(), trip({ id: 'paris', parent_id: 'eu', name: 'paris', start_date: '2027-02-19', end_date: '2027-02-23', color: 2 })]
    db.stops = [
      stop({ id: 'museum', trip_id: 'eu', day: '2027-01-30', title: 'van abbemuseum' }),
      stop({ id: 'louvre', trip_id: 'paris', day: '2027-02-20', title: 'louvre', status: 'to_book' }),
    ]
  })

  it('is a month calendar: side trips colour their days and open from it, the trip\'s own days have dots', async () => {
    show(eu(), '/trip/eu?day=2027-02-19', false)
    const cal = screen.getByRole('group', { name: 'february 2027' })
    // the same ribbons as home's calendar: the side trip's days wear its colour, the trip's own days the trip's
    expect(cal.querySelector('[data-day="2027-02-19"]')).toHaveAttribute('data-ribbon', 'start')
    expect((cal.querySelector('[data-day="2027-02-20"]') as HTMLElement).style.getPropertyValue('--c')).toBe('var(--g2)')
    expect((cal.querySelector('[data-day="2027-02-18"]') as HTMLElement).style.getPropertyValue('--c')).toBe('var(--g0)')
    expect(cal.querySelector('.cal-label')).toBeNull()
    // tapping a side trip's day opens that side trip on it
    await userEvent.click(within(cal).getByRole('button', { name: 'sat 20 feb' }))
    expect(screen.getByTestId('loc').textContent).toBe('?day=2027-02-20')
    expect(screen.queryByText('louvre')).toBeNull()
    // the side trips of the month, each a line that opens it
    const list = within(screen.getByRole('list', { name: 'side trips this month' }))
    expect(list.getByRole('link', { name: /paris.*19 – 23 feb.*1 place.*1 to do/ })).toHaveAttribute('href', '/trip/paris')
    // no long list of every day
    expect(screen.queryByRole('navigation', { name: 'days' })).toBeNull()
  })

  it('picking one of the trip\'s own days shows that day under the calendar', async () => {
    show(eu(), '/trip/eu?day=2027-02-19', false)
    await userEvent.click(screen.getByRole('button', { name: 'previous month' }))
    const cal = screen.getByRole('group', { name: 'january 2027' })
    expect(cal.querySelector('[data-day="2027-01-30"]')).toHaveAttribute('data-planned')
    await userEvent.click(within(cal).getByRole('button', { name: 'sat 30 jan' }))
    expect(screen.getByRole('heading', { level: 2, name: 'saturday 30 january' })).toBeInTheDocument()
    expect(screen.getByText('van abbemuseum')).toBeInTheDocument()
    expect(linkDay()).toBe('2027-01-30')
  })

  it('search still finds what is inside the side trips', async () => {
    show(eu(), '/trip/eu', false)
    await search('louvre')
    expect(screen.getByTestId('match-count')).toHaveTextContent('1 of 1')
    expect(screen.getByText('louvre')).toBeInTheDocument()
  })

  it('while a side trip is on, the top says so and opens it on today', () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2027-02-21T10:00:00'))
    try {
      show(eu(), '/trip/eu', false)
      const now = screen.getByRole('link', { name: /now · day 3 of 5/ })
      expect(now).toHaveAttribute('href', '/trip/paris?day=2027-02-21')
    } finally { vi.useRealTimers() }
  })
})

it('a booking ref keeps its capitals', () => {
  db.trips = [tokyo()]
  db.stops = [stop({ id: 'fl', trip_id: 'tk', kind: 'journey', day: '2025-09-18', time: '22:00', title: 'sq 638', ref: 'KL934', origin: place({ name: 'changi' }), destination: place({ name: 'narita' }) })]
  show(tokyo(), undefined, false)
  expect(screen.getByText('KL934')).toHaveClass('keep-case')
})

it('a day heading carries no "day n" count, and no empty line under it when there is nothing to say', () => {
  show(tokyo())
  expect(screen.queryByText(/^day \d+$/)).toBeNull()
  // 18 sept has no area, side trip or today tag: nothing sits under its heading
  expect(screen.getByTestId('itin-2025-09-18').querySelector('.doc-day-meta')).toBeNull()
  // 19 sept still names where the day is
  expect(meta('2025-09-19')).toHaveTextContent('shibuya')
})

describe('removing a line', () => {
  it('on a laptop, × at the end of a line removes it at once, with undo', async () => {
    show(tokyo())
    await userEvent.click(screen.getByRole('button', { name: 'remove neel' }))
    expect(db.remove).toHaveBeenCalledWith('neel', 'neel')
  })

  it('a booked line, or one holding tickets or a cost, asks once first', async () => {
    db.stops = (db.stops as ReturnType<typeof stop>[]).map((s) => (s.id === 'neel' ? { ...s, status: 'booked' as const } : s))
    db.files = [{ id: 'f', stop_id: 'enji', path: 'x' }]
    show(tokyo())
    const x = screen.getByRole('button', { name: 'remove neel' })
    await userEvent.click(x)
    expect(db.remove).not.toHaveBeenCalled()
    expect(x).toHaveTextContent('remove?')
    await userEvent.click(x)
    expect(db.remove).toHaveBeenCalledWith('neel', 'neel')
    await userEvent.click(screen.getByRole('button', { name: 'remove enji' }))
    expect(db.remove).toHaveBeenCalledTimes(1)
  })

  it('on a phone, swiping a line left removes it, with undo; a booked one stays', () => {
    db.stops = (db.stops as ReturnType<typeof stop>[]).map((s) => (s.id === 'enji' ? { ...s, status: 'booked' as const } : s))
    show(tokyo(), '/trip/tk?tab=itinerary', false)
    expect(screen.queryByRole('button', { name: 'remove neel' })).toBeNull()
    const swipe = (id: string) => {
      const line = document.querySelector(`[data-line="${id}"]`) as HTMLElement
      fireEvent.pointerDown(line, { clientX: 300, pointerId: 1 })
      fireEvent.pointerMove(line, { clientX: 150, pointerId: 1 })
      fireEvent.pointerUp(line, { clientX: 150, pointerId: 1 })
    }
    swipe('neel')
    expect(db.remove).toHaveBeenCalledWith('neel', 'neel')
    swipe('enji')
    expect(db.remove).toHaveBeenCalledTimes(1)
  })
})
