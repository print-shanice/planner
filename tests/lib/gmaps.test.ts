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

it('a flight gives directions to its departure airport, without routing along the flight', () => {
  const url = new URL(gmapsUrl(stop({ kind: 'journey', mode: 'flight',
    origin: place({ name: 'Changi Airport' }), destination: place({ name: 'Taoyuan Airport' }) }))!)
  expect(url.searchParams.get('destination')).toBe('Changi Airport')
  expect(url.searchParams.has('origin')).toBe(false)
  expect(url.searchParams.has('travelmode')).toBe(false)
  expect(gmapsUrl(stop({ kind: 'journey', mode: 'flight', origin: null, destination: place({ name: 'Taoyuan Airport' }) }))).toBeNull()
})

it('a nameless point uses its coordinates', () => {
  expect(gmapsUrl(stop({ place: place({ name: '', address: '', lat: 66.5, lng: 25.7 }) }))).toBe('https://www.google.com/maps/search/?api=1&query=66.5%2C25.7')
})

it('nothing to show gives no link', () => {
  expect(gmapsUrl(stop({ kind: 'note', place: null }))).toBeNull()
})

it('directions start at the current location and use the destination name and address', () => {
  const url = new URL(directionsUrl(place({ name: 'Arktikum', address: 'Pohjoisranta 4, Rovaniemi', lat: 66.5, lng: 25.7 }))!)
  expect(url.pathname).toBe('/maps/dir/')
  expect(url.searchParams.get('destination')).toBe('Arktikum, Pohjoisranta 4, Rovaniemi')
  expect(url.searchParams.has('origin')).toBe(false)
  expect(url.searchParams.has('origin_place_id')).toBe(false)
  expect(url.searchParams.has('travelmode')).toBe(false)
})

it('directions preserve the Google Place ID for the exact destination', () => {
  const p = place({ name: 'kopi', gid: 'ChIJ1' })
  expect(gmapsUrl(stop({ place: p }))).toContain('query_place_id=ChIJ1')
  const url = new URL(directionsUrl(p)!)
  expect(url.searchParams.get('destination')).toBe('kopi')
  expect(url.searchParams.get('destination_place_id')).toBe('ChIJ1')
})

it('directions fall back to coordinates for an unnamed pin', () => {
  const url = new URL(directionsUrl(place({ name: '', address: '', lat: 66.5, lng: 25.7 }))!)
  expect(url.searchParams.get('destination')).toBe('66.5,25.7')
})

it('directions need a destination', () => {
  expect(directionsUrl(null)).toBeNull()
  expect(directionsUrl(place({ name: '', address: '', lat: null, lng: null }))).toBeNull()
})
