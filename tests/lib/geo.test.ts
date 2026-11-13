import { distanceKm } from '../../src/lib/geo'

it('distanceKm is the great-circle distance', () => {
  // eindhoven to paris is about 350 km as the crow flies
  expect(Math.round(distanceKm({ lat: 51.44, lng: 5.48 }, { lat: 48.86, lng: 2.35 }))).toBeGreaterThan(330)
  expect(Math.round(distanceKm({ lat: 51.44, lng: 5.48 }, { lat: 48.86, lng: 2.35 }))).toBeLessThan(370)
  expect(distanceKm({ lat: 1, lng: 2 }, { lat: 1, lng: 2 })).toBe(0)
  // opposite sides of the earth stay a number
  expect(distanceKm({ lat: 0, lng: 0 }, { lat: 0, lng: 180 })).toBeCloseTo(Math.PI * 6371, 0)
})
