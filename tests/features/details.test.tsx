import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const g = vi.hoisted(() => ({ fetch: vi.fn(), wiki: vi.fn(), verse: vi.fn(), online: true }))
vi.mock('../../src/lib/google/loader', () => ({
  lib: async () => ({ Place: class { constructor(public o: { id: string }) {} fetchFields(o: { fields: string[] }) { return g.fetch(this.o.id, o.fields) } } }),
}))
vi.mock('../../src/lib/offline', () => ({ useOnline: () => g.online }))
vi.mock('../../src/lib/wiki', () => ({ wikiPhoto: g.wiki }))
vi.mock('../../src/lib/openverse', () => ({ openversePhoto: g.verse }))

import { PlaceDetails } from '../../src/features/stops/PlaceDetails'

const place = { name: 'Hop Inn', lat: 35, lng: 135, gid: 'g1' }
const fields = {
  rating: 4.2, userRatingCount: 244, primaryTypeDisplayName: 'Hotel', photos: [{ getURI: () => 'https://img/hop.jpg' }],
  regularOpeningHours: { weekdayDescriptions: ['Monday: 9:00 AM – 5:00 PM', 'Tuesday: 9:00 AM – 5:00 PM', 'Wednesday: 9:00 AM – 5:00 PM', 'Thursday: 9:00 AM – 5:00 PM', 'Friday: 9:00 AM – 5:00 PM', 'Saturday: 10:00 AM – 2:00 PM', 'Sunday: Closed'] },
  websiteURI: 'https://hopinn.example/',
}
const show = (el: JSX.Element) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{el}</QueryClientProvider>)

beforeEach(() => { vi.stubEnv('VITE_GOOGLE_MAPS_KEY', 'k'); g.online = true; g.fetch.mockReset().mockResolvedValue({ place: fields }); g.wiki.mockReset().mockResolvedValue(null); g.verse.mockReset().mockResolvedValue(null) })

it('says it is asking, then shows the photo, the rating, what it is, the day\'s hours and the website', async () => {
  g.verse.mockResolvedValue({ src: 'https://api.openverse.org/v1/images/hop/thumb/', page: 'https://www.flickr.com/photos/x/hop', source: 'flickr' })
  show(<PlaceDetails place={place} day="2027-02-06" />)
  expect(screen.getByText('asking google')).toBeInTheDocument()
  expect(await screen.findByText('★ 4.2 · 244 reviews · hotel')).toBeInTheDocument()
  expect(screen.getByText('sat 10:00–14:00')).toBeInTheDocument()
  const img = await screen.findByRole('img', { name: 'Hop Inn' })
  expect(img).toHaveAttribute('src', 'https://api.openverse.org/v1/images/hop/thumb/')
  fireEvent.load(img)
  expect(screen.getByRole('link', { name: 'photo · flickr' })).toHaveAttribute('href', 'https://www.flickr.com/photos/x/hop')
  expect(screen.getByRole('link', { name: 'website' })).toHaveAttribute('href', 'https://hopinn.example/')
  expect(g.fetch).toHaveBeenCalledWith('g1', expect.arrayContaining(['rating']))
  expect(g.fetch.mock.calls[0][1]).not.toContain('photos')
})

it('asks nothing without google, offline, or for a place google did not find', () => {
  vi.stubEnv('VITE_GOOGLE_MAPS_KEY', '')
  const { unmount } = show(<PlaceDetails place={place} day={null} />)
  expect(screen.queryByText('asking google')).toBeNull()
  unmount()
  vi.stubEnv('VITE_GOOGLE_MAPS_KEY', 'k')
  g.online = false
  const second = show(<PlaceDetails place={place} day={null} />)
  expect(screen.queryByText('asking google')).toBeNull()
  second.unmount()
  g.online = true
  show(<PlaceDetails place={{ name: 'park', lat: 1, lng: 1 }} day={null} />)
  expect(screen.queryByText('asking google')).toBeNull()
  expect(g.fetch).not.toHaveBeenCalled()
})

it('a place google knows little about shows what there is, and a refusal shows nothing', async () => {
  g.fetch.mockResolvedValue({ place: { rating: null, primaryTypeDisplayName: 'Park' } })
  const { unmount } = show(<PlaceDetails place={place} day={null} />)
  expect(await screen.findByText('park')).toBeInTheDocument()
  expect(screen.queryByRole('img')).toBeNull()
  unmount()
  g.fetch.mockRejectedValue(new Error('no'))
  const { container } = show(<PlaceDetails place={{ ...place, gid: 'g2' }} day={null} />)
  await screen.findByText('asking google')
  await vi.waitFor(() => expect(screen.queryByText('asking google')).toBeNull())
  // and no free photo either, once that's been looked for
  await vi.waitFor(() => expect(screen.queryByRole('status', { name: 'loading photo' })).toBeNull())
  expect(container).toBeEmptyDOMElement()
})

it('the full card shows wikipedia\'s photo first, credited', async () => {
  g.wiki.mockResolvedValue({ src: 'https://upload.wikimedia.org/hop.jpg', page: 'https://en.wikipedia.org/wiki/File:Hop.jpg' })
  show(<PlaceDetails place={place} day={null} />)
  const img = await screen.findByRole('img', { name: 'Hop Inn' })
  expect(img).toHaveAttribute('src', 'https://upload.wikimedia.org/hop.jpg')
  expect(screen.getByRole('status', { name: 'loading photo' })).toBeInTheDocument()
  fireEvent.load(img)
  expect(screen.queryByRole('status', { name: 'loading photo' })).toBeNull()
  expect(screen.getByRole('link', { name: 'photo · wikimedia' })).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/File:Hop.jpg')
})
