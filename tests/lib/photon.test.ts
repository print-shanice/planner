import { parsePhoton, searchPlaces, reversePlace } from '../../src/lib/photon'

const fixture = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [25.7287, 66.5079] },
      properties: { osm_type: 'W', osm_id: 123, name: 'Arktikum', street: 'Pohjoisranta', housenumber: '4', city: 'Rovaniemi', countrycode: 'fi', type: 'house' },
    },
  ],
}

afterEach(() => vi.restoreAllMocks())

it('parses photon features', () => {
  expect(parsePhoton(fixture)).toEqual([
    { name: 'Arktikum', address: 'Pohjoisranta 4, Rovaniemi', city: 'Rovaniemi', country: 'FI', lat: 66.5079, lng: 25.7287, osm_id: 'W123' },
  ])
})

it('a city result is its own city', () => {
  const [p] = parsePhoton({ features: [{ geometry: { coordinates: [4.9, 52.37] }, properties: { osm_type: 'R', osm_id: 1, name: 'Amsterdam', type: 'city', countrycode: 'NL', state: 'North Holland' } }] })
  expect(p.city).toBe('Amsterdam')
  expect(p.address).toBe('North Holland')
})

it('bad input parses to nothing', () => {
  expect(parsePhoton(null)).toEqual([])
  expect(parsePhoton({ features: [{ properties: {} }] })).toEqual([])
})

it('search asks photon near a point', async () => {
  const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(fixture)))
  const out = await searchPlaces('arktikum', { lat: 66.5, lng: 25.7 })
  const url = String(spy.mock.calls[0][0])
  expect(url).toContain('photon.komoot.io/api?q=arktikum&limit=6&lang=en')
  expect(url).toContain('&lat=66.5&lon=25.7')
  expect(out[0].name).toBe('Arktikum')
})

it('search throws when photon fails so the ui can offer retry', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('busy', { status: 503 }))
  await expect(searchPlaces('x')).rejects.toThrow()
})

it('reverse keeps the tapped point', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(fixture)))
  const p = await reversePlace(66.5, 25.72)
  expect(p).toMatchObject({ name: 'Arktikum', lat: 66.5, lng: 25.72 })
})
