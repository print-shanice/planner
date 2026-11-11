import { diffWords, offsetOf, placeCode, zoneOf } from '../../src/lib/localTime'

it('finds a country\'s zone, splitting the wide ones by longitude', () => {
  expect(zoneOf('fr')).toBe('Europe/Paris')
  expect(zoneOf('JP', 139.7)).toBe('Asia/Tokyo')
  expect(zoneOf('US', -74)).toBe('America/New_York')
  expect(zoneOf('US', -122.4)).toBe('America/Los_Angeles')
  expect(zoneOf('US', -157.8)).toBe('Pacific/Honolulu')
  expect(zoneOf('AU', 151.2)).toBe('Australia/Sydney')
  expect(zoneOf('AU', 115.9)).toBe('Australia/Perth')
  expect(zoneOf('ES', -15.4)).toBe('Atlantic/Canary')
  expect(zoneOf('xx')).toBeNull()
  expect(zoneOf(null)).toBeNull()
})

it('reads a zone\'s offset at a moment, summer time included', () => {
  expect(offsetOf('Europe/Paris', new Date('2027-01-15T12:00:00Z'))).toBe(60)
  expect(offsetOf('Europe/Paris', new Date('2027-07-15T12:00:00Z'))).toBe(120)
  expect(offsetOf('Asia/Kolkata', new Date('2027-01-15T12:00:00Z'))).toBe(330)
})

it('says how far the trip\'s clock is from yours', () => {
  expect(diffWords(60, 60)).toBe('same time as you')
  expect(diffWords(540, 60)).toBe('+8h from you')
  expect(diffWords(330, 60)).toBe('+4h30 from you')
  expect(diffWords(-300, 60)).toBe('−6h from you')
})

it('shortens a place to three letters, as a departures board would', () => {
  expect(placeCode('Paris')).toBe('par')
  expect(placeCode('São Paulo')).toBe('sao')
  expect(placeCode('Ho Chi Minh')).toBe('hoc')
  expect(placeCode(null)).toBe('')
})
