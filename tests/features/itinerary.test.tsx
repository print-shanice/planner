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
  expect(screen.queryAllByRole('button', { expanded: false })).toHaveLength(0)
  const lines = dayBox('2025-09-19').getAllByTestId('itin-line')
  // a live line's time is in its boxes; an empty start reads "any"
  const shown = (l: HTMLElement) => {
    const [from, till] = [...l.querySelectorAll<HTMLInputElement>('.itin-time input')]
    return from ? (from.value || from.placeholder) + (till?.value ? `–${till.value}` : '') : l.querySelector('.itin-time')?.textContent
  }
  expect(lines.map(shown)).toEqual(['09:00', '17:00–18:30', 'any'])
  expect(lines[2]).toHaveTextContent('cafe · tokyo')
  expect(lines[2].querySelector('.cat')).toHaveAttribute('title', 'cafe')
  expect(screen.getAllByRole('heading', { level: 2 }).map((x) => x.textContent)).toEqual(['thursday 18 september', 'friday 19 september', 'saturday 20 september'])
})

it('nothing folds: there are no day toggles to open', () => {
  show(tokyo())
  expect(document.querySelectorAll('[aria-expanded]')).toHaveLength(0)
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

it('untimed lines reorder by keyboard on their handle; timed lines have none', async () => {
  db.stops = [
    stop({ id: 'x', trip_id: 'tk', day: '2025-09-19', time: '09:00', title: 'timed' }),
    stop({ id: 'p', trip_id: 'tk', day: '2025-09-19', title: 'first', position: 0 }),
    stop({ id: 'q', trip_id: 'tk', day: '2025-09-19', title: 'second', position: 1 }),
  ]
  show(tokyo(), undefined, false)
  expect(screen.queryByRole('button', { name: /move timed/ })).toBeNull()
  const grip = screen.getByRole('button', { name: /move second/ })
  grip.focus()
  await userEvent.keyboard('{ArrowUp}')
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
  await userEvent.click(dayBox('2025-09-19').getByRole('button', { name: /narita airport t2/ }))
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
    expect(within(cal).getByRole('link', { name: /paris/ })).toHaveAttribute('href', '/trip/paris')
    expect(cal.querySelector('[data-day="2027-02-20"]')).toHaveAttribute('data-side')
    expect(screen.queryByText('louvre')).toBeNull()
    // the side trips of the month, each a line that opens it
    const list = within(screen.getByRole('list', { name: 'side trips this month' }))
    expect(list.getByRole('link', { name: /paris.*19 – 23 feb.*1 place.*1 to book/ })).toHaveAttribute('href', '/trip/paris')
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
