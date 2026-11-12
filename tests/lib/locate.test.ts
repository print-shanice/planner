import { place } from '../factories'

const g = vi.hoisted(() => ({ on: false, suggest: vi.fn(), pick: vi.fn() }))
vi.mock('../../src/lib/google/config', () => ({ googleConfigured: () => g.on }))
vi.mock('../../src/lib/google/places', () => ({
  PlaceSession: class { suggest = g.suggest; pick = g.pick },
}))
const photon = vi.hoisted(() => ({ search: vi.fn() }))
vi.mock('../../src/lib/photon', () => ({ searchPlaces: photon.search }))

import { locate } from '../../src/lib/locate'

const tokyo = { lat: 35.68, lng: 139.76 }

beforeEach(() => { g.on = false; g.suggest.mockReset(); g.pick.mockReset(); photon.search.mockReset() })

it('without google, takes the closest openstreetmap result to the day', async () => {
  const far = place({ name: 'im donut', lat: 34.69, lng: 135.5 })
  const near = place({ name: 'im donut', lat: 35.66, lng: 139.7 })
  photon.search.mockResolvedValue([far, near])
  expect(await locate('im donut', tokyo)).toEqual(near)
  expect(photon.search).toHaveBeenCalledWith('im donut', tokyo)
})

it('with google, picks the first suggestion near the day', async () => {
  g.on = true
  g.suggest.mockResolvedValue([{ id: 'g1', name: 'Kyoto Obuya', sub: 'Kyoto', types: [] }])
  const found = place({ name: 'Kyoto Obuya', lat: 35.0, lng: 135.76, gid: 'g1' })
  g.pick.mockResolvedValue(found)
  expect(await locate('kyoto obuya', { lat: 35.0, lng: 135.77 })).toEqual(found)
  expect(g.suggest).toHaveBeenCalledWith('kyoto obuya', { lat: 35.0, lng: 135.77 })
  expect(photon.search).not.toHaveBeenCalled()
})

it('a result far from where the day happens is not the place', async () => {
  photon.search.mockResolvedValue([place({ name: '2nd street', lat: 1.3, lng: 103.8 })])
  expect(await locate('2nd street', tokyo)).toBeNull()
})

it('with nowhere to go by, the first result will do', async () => {
  const p = place({ name: 'asakura museum of sculpture', lat: 35.72, lng: 139.77 })
  photon.search.mockResolvedValue([p])
  expect(await locate('asakura museum of sculpture', null)).toEqual(p)
})

it('nothing found, or a blank name, is null', async () => {
  photon.search.mockResolvedValue([])
  expect(await locate('zzzz', tokyo)).toBeNull()
  expect(await locate('  ', tokyo)).toBeNull()
  expect(photon.search).toHaveBeenCalledTimes(1)
})
