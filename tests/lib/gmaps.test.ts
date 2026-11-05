import { gmapsUrl } from '../../src/lib/gmaps'
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
