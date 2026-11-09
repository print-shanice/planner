import { gmapsUrl, directionsUrl } from '../../src/lib/gmaps'
import { stop, place } from '../factories'

it('maps link for a place', () => {
  expect(gmapsUrl(stop({ place: place({ name: 'Arktikum', address: 'Pohjoisranta 4, Rovaniemi' }) })))
    .toBe('https://www.google.com/maps/search/?api=1&query=Arktikum%2C%20Pohjoisranta%204%2C%20Rovaniemi')
})

it('walking directions for a journey', () => {
  const url = gmapsUrl(stop({ kind: 'journey', origin: place({ name: 'Naples', address: '' }), destination: place({ name: 'Ischia', address: '' }) }))!
  expect(url).toBe('https://www.google.com/maps/dir/?api=1&origin=Naples&destination=Ischia&travelmode=walking')
})

it('public transport directions for a train', () => {
  expect(gmapsUrl(stop({ kind: 'journey', mode: 'train', origin: place({ name: 'Eindhoven' }), destination: place({ name: 'Paris' }) }))).toContain('travelmode=transit')
})

it('a nameless point uses its coordinates', () => {
  expect(gmapsUrl(stop({ place: place({ name: '', address: '', lat: 66.5, lng: 25.7 }) }))).toBe('https://www.google.com/maps/search/?api=1&query=66.5%2C25.7')
})

it('nothing to show gives no link', () => {
  expect(gmapsUrl(stop({ kind: 'note', place: null }))).toBeNull()
})

it('directions between two stops use their coordinates and leave the mode to google', () => {
  expect(directionsUrl(place({ name: 'a', lat: 37.97, lng: 23.72 }), place({ name: 'b', lat: 37.98, lng: 23.74 })))
    .toBe('https://www.google.com/maps/dir/?api=1&origin=37.97%2C23.72&destination=37.98%2C23.74')
})

it('opens google\'s own place when the place came from google', () => {
  const p = { name: 'kopi', lat: 51.4, lng: 5.4, gid: 'ChIJ1' }
  expect(gmapsUrl({ kind: 'place', place: p } as never)).toContain('query_place_id=ChIJ1')
  expect(directionsUrl({ name: 'a', lat: 1, lng: 2 }, p)).toContain('destination_place_id=ChIJ1')
})
