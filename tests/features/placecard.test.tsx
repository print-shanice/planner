import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { trip, stop, place } from '../factories'

const g = vi.hoisted(() => ({ fetch: vi.fn(), wiki: vi.fn(), verse: vi.fn(), stops: [] as unknown[], trips: [] as unknown[], save: vi.fn(), move: vi.fn() }))
vi.mock('../../src/lib/google/loader', () => ({
  lib: async () => ({ Place: class { constructor(public o: { id: string }) {} fetchFields(o: { fields: string[] }) { return g.fetch(this.o.id, o.fields) } } }),
}))
vi.mock('../../src/lib/offline', () => ({ useOnline: () => true, useCanEdit: () => true }))
vi.mock('../../src/lib/queries', () => ({
  useTrips: () => ({ data: g.trips }),
  useStops: () => ({ data: g.stops }),
  useCosts: () => ({ data: [] }),
  useSave: () => ({ mutateAsync: g.save, mutate: g.save, isPending: false }),
}))
vi.mock('../../src/features/itinerary/useMove', () => ({ useMove: () => g.move }))
vi.mock('../../src/lib/wiki', () => ({ wikiPhoto: g.wiki }))
vi.mock('../../src/lib/openverse', () => ({ openversePhoto: g.verse }))

import { PlaceCard } from '../../src/features/map/PlaceCard'

const paris = trip({ id: 'par', name: 'paris', start_date: '2027-02-19', end_date: '2027-02-23' })
const eiffel = place({ name: 'Eiffel Tower', address: 'Av. Gustave Eiffel, Paris', city: 'Paris', lat: 48.86, lng: 2.29, gid: 'g-eiffel', category: 'sight' })
const HOURS = ['Monday: 9:00 AM – 6:00 PM', 'Tuesday: 9:00 AM – 6:00 PM', 'Wednesday: 9:00 AM – 6:00 PM', 'Thursday: 9:00 AM – 9:45 PM', 'Friday: 9:00 AM – 6:00 PM', 'Saturday: 9:00 AM – 6:00 PM', 'Sunday: Closed']
const google = {
  rating: 4.7, userRatingCount: 420_000, primaryTypeDisplayName: 'Historical landmark',
  regularOpeningHours: { weekdayDescriptions: HOURS }, websiteURI: 'https://www.toureiffel.paris/',
}

const show = (props: Partial<Parameters<typeof PlaceCard>[0]> = {}) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <PlaceCard trip={paris} place={eiffel} defaultDay="2027-02-19" day="2027-02-19" onClose={vi.fn()} {...props} />
  </QueryClientProvider>,
)
const before = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

beforeEach(() => {
  vi.stubEnv('VITE_GOOGLE_MAPS_KEY', 'k')
  g.trips = [paris]
  g.stops = []
  g.save.mockReset().mockResolvedValue({})
  g.move.mockReset()
  g.fetch.mockReset().mockResolvedValue({ place: google })
  g.wiki.mockReset().mockResolvedValue(null)
  g.verse.mockReset().mockResolvedValue(null)
})

const wiki = { src: 'https://upload.wikimedia.org/eiffel.jpg', page: 'https://en.wikipedia.org/wiki/File:Eiffel.jpg' }
const verse = { src: 'https://api.openverse.org/v1/images/dp1/thumb/', page: 'https://www.flickr.com/photos/x/dp1', source: 'flickr' }

it('a found place: photo on top, what and where, then reviews and the day\'s hours on lines of their own', async () => {
  g.wiki.mockResolvedValue(wiki)
  show()
  const card = screen.getByRole('region', { name: 'Eiffel Tower' })
  expect(within(card).getByText('asking google')).toBeInTheDocument()
  const photo = await within(card).findByRole('img', { name: 'Eiffel Tower' })
  expect(photo).toHaveAttribute('src', wiki.src)
  // google's word for what it is, said once, replacing ours
  expect(within(card).getByText('historical landmark · Av. Gustave Eiffel, Paris')).toBeInTheDocument()
  expect(within(card).queryByText(/sight/)).toBeNull()
  const reviews = within(card).getByText('★ 4.7 · 420,000 reviews')
  const hours = within(card).getByText('fri 09:00–18:00')
  expect(before(photo, reviews)).toBe(true)
  expect(before(reviews, hours)).toBe(true)
})

it('the day line reads like the plan: the time, then the day, then "add"', async () => {
  show()
  const card = screen.getByRole('region', { name: 'Eiffel Tower' })
  const time = within(card).getByRole('textbox', { name: 'time' })
  const day = within(card).getByRole('button', { name: 'day: fri 19 feb' })
  const add = within(card).getByRole('button', { name: 'add to fri 19 feb' })
  expect(add).toHaveTextContent(/^add$/)
  expect(before(time, day)).toBe(true)
  expect(before(day, add)).toBe(true)
  await userEvent.type(time, '1530')
  expect(within(card).getByRole('button', { name: 'add to fri 19 feb at 15:30' })).toHaveTextContent(/^add$/)
})

it('with no date, the time stays in place but can\'t be typed in, and the word is "save"', async () => {
  show({ defaultDay: null, day: null })
  const card = screen.getByRole('region', { name: 'Eiffel Tower' })
  expect(within(card).getByRole('textbox', { name: 'time' })).toBeDisabled()
  const save = within(card).getByRole('button', { name: 'save as an idea' })
  expect(save).toHaveTextContent(/^save$/)
  await userEvent.click(save)
  expect(g.save).toHaveBeenCalledWith(expect.objectContaining({ title: 'Eiffel Tower', day: null, saved: true }))
})

it('google maps with google\'s mark, and the website with a globe on a line of its own', async () => {
  show()
  const card = screen.getByRole('region', { name: 'Eiffel Tower' })
  const site = await within(card).findByRole('link', { name: 'website' })
  expect(site).toHaveAttribute('href', 'https://www.toureiffel.paris/')
  expect(site.querySelector('svg')).not.toBeNull()
  const maps = within(card).getByRole('link', { name: 'google maps' })
  expect(maps.querySelector('img, svg')).not.toBeNull()
  expect(maps.parentElement).toBe(site.parentElement)
  expect(before(maps, site)).toBe(true)
})

it('a line google has nothing for is left out, and with no photo the card closes up', async () => {
  g.fetch.mockResolvedValue({ place: { rating: null, primaryTypeDisplayName: 'Bakery' } })
  show()
  const card = screen.getByRole('region', { name: 'Eiffel Tower' })
  await within(card).findByText('bakery · Av. Gustave Eiffel, Paris')
  expect(within(card).queryByRole('img')).toBeNull()
  expect(within(card).queryByText(/reviews/)).toBeNull()
  expect(within(card).queryByRole('link', { name: 'website' })).toBeNull()
  await vi.waitFor(() => expect(g.verse).toHaveBeenCalled())
  await vi.waitFor(() => expect(card).not.toHaveClass('has-photo'))
  expect(within(card).getByRole('button', { name: 'close' })).toBeInTheDocument()
})

it('with a photo it sits across the top, under the one ✕', async () => {
  g.wiki.mockResolvedValue(wiki)
  show()
  const card = screen.getByRole('region', { name: 'Eiffel Tower' })
  await within(card).findByRole('img', { name: 'Eiffel Tower' })
  expect(card).toHaveClass('has-photo')
  expect(within(card).getAllByRole('button', { name: 'close' })).toHaveLength(1)
})

it('a pin already in the plan: "details" takes the day line\'s place', async () => {
  const planned = stop({ id: 'e1', trip_id: 'par', title: 'eiffel tower', day: '2027-02-20', time: '15:30', place: eiffel })
  g.stops = [planned]
  show({ stop: planned })
  const card = screen.getByRole('region', { name: 'eiffel tower' })
  expect(within(card).getByRole('button', { name: 'details' })).toBeInTheDocument()
  expect(within(card).queryByRole('textbox', { name: 'time' })).toBeNull()
  expect(await within(card).findByText('sat 09:00–18:00')).toBeInTheDocument()
})

it('an idea: "add" waits for a day', () => {
  const idea = stop({ id: 'i1', trip_id: 'par', title: 'eiffel tower', day: null, saved: true, place: eiffel })
  g.stops = [idea]
  show({ stop: idea, defaultDay: null, day: null })
  const card = screen.getByRole('region', { name: 'eiffel tower' })
  expect(within(card).getByRole('button', { name: 'add to a day' })).toBeDisabled()
  expect(within(card).getByRole('button', { name: 'details' })).toBeInTheDocument()
})

describe('photos: wikipedia first, then openverse, never google', () => {
  it('wikipedia\'s, with a small credit linking to the photo\'s page; openverse isn\'t asked', async () => {
    g.wiki.mockResolvedValue(wiki)
    show()
    const card = screen.getByRole('region', { name: 'Eiffel Tower' })
    const img = await within(card).findByRole('img', { name: 'Eiffel Tower' })
    expect(img).toHaveAttribute('src', wiki.src)
    fireEvent.load(img)
    expect(within(card).getByRole('link', { name: 'photo · wikimedia' })).toHaveAttribute('href', wiki.page)
    expect(g.wiki).toHaveBeenCalledWith(expect.objectContaining({ name: 'Eiffel Tower', lat: 48.86, lng: 2.29 }))
    expect(g.verse).not.toHaveBeenCalled()
  })

  it('no wikipedia page: openverse\'s, credited to where it\'s from', async () => {
    g.verse.mockResolvedValue(verse)
    show()
    const card = screen.getByRole('region', { name: 'Eiffel Tower' })
    const img = await within(card).findByRole('img', { name: 'Eiffel Tower' })
    expect(img).toHaveAttribute('src', verse.src)
    fireEvent.load(img)
    expect(within(card).getByRole('link', { name: 'photo · flickr' })).toHaveAttribute('href', verse.page)
    expect(g.verse).toHaveBeenCalledWith(expect.objectContaining({ name: 'Eiffel Tower', city: 'Paris' }))
  })

  it('google is never asked for photos, and any it sends are not shown', async () => {
    g.fetch.mockResolvedValue({ place: { ...google, photos: [{ getURI: () => 'https://img/eiffel.jpg' }] } })
    show()
    const card = screen.getByRole('region', { name: 'Eiffel Tower' })
    await within(card).findByText('★ 4.7 · 420,000 reviews')
    await vi.waitFor(() => expect(g.verse).toHaveBeenCalled())
    expect(g.fetch.mock.calls[0][1]).not.toContain('photos')
    expect(within(card).queryByRole('img')).toBeNull()
  })

  it('works without google at all, for a place with a spot', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_KEY', '')
    g.wiki.mockResolvedValue(wiki)
    show({ place: { ...eiffel, gid: undefined } })
    expect(await screen.findByRole('img', { name: 'Eiffel Tower' })).toHaveAttribute('src', wiki.src)
    expect(g.fetch).not.toHaveBeenCalled()
  })

  it('nothing found: the card closes up', async () => {
    show()
    const card = screen.getByRole('region', { name: 'Eiffel Tower' })
    await vi.waitFor(() => expect(g.verse).toHaveBeenCalled())
    await vi.waitFor(() => expect(card).not.toHaveClass('has-photo'))
    expect(within(card).queryByRole('img')).toBeNull()
  })
})

describe('while the photo is coming, totoro (the planner\'s one loading look)', () => {
  it('holds its place while it is looked for and while it loads, then steps aside; the credit comes with the photo', async () => {
    let found: (v: unknown) => void = () => {}
    g.wiki.mockReturnValue(new Promise((r) => { found = r }))
    show()
    const card = screen.getByRole('region', { name: 'Eiffel Tower' })
    expect(await within(card).findByRole('status', { name: 'loading photo' })).toBeInTheDocument()
    found(wiki)
    const img = await within(card).findByRole('img', { name: 'Eiffel Tower' })
    expect(within(card).getByRole('status', { name: 'loading photo' })).toBeInTheDocument()
    expect(within(card).queryByRole('link', { name: /photo ·/ })).toBeNull()
    fireEvent.load(img)
    expect(within(card).queryByRole('status', { name: 'loading photo' })).toBeNull()
    expect(within(card).getByRole('link', { name: 'photo · wikimedia' })).toBeInTheDocument()
  })

  it('a photo that won\'t load is dropped and the card closes up', async () => {
    g.wiki.mockResolvedValue(wiki)
    show()
    const card = screen.getByRole('region', { name: 'Eiffel Tower' })
    fireEvent.error(await within(card).findByRole('img', { name: 'Eiffel Tower' }))
    expect(within(card).queryByRole('img', { name: 'Eiffel Tower' })).toBeNull()
    expect(within(card).queryByRole('status', { name: 'loading photo' })).toBeNull()
    expect(card).not.toHaveClass('has-photo')
  })
})
