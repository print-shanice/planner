import { place } from '../factories'

const g = vi.hoisted(() => ({ on: false, suggest: vi.fn(), pick: vi.fn() }))
vi.mock('../../src/lib/google/config', () => ({ googleConfigured: () => g.on }))
vi.mock('../../src/lib/google/places', () => ({ PlaceSession: class { suggest = g.suggest; pick = g.pick } }))
const photon = vi.hoisted(() => ({ spots: vi.fn() }))
vi.mock('../../src/lib/photon', () => ({ searchSpots: photon.spots }))

import { plainMatch, quietFind } from '../../src/lib/quietFind'

const kyoto = { lat: 35.0, lng: 135.76 }
const sug = (id: string, name: string, sub: string) => ({ id, name, sub, types: [] })

beforeEach(() => { g.on = true; g.suggest.mockReset(); g.pick.mockReset(); photon.spots.mockReset() })

describe('plainMatch', () => {
  it('every word typed is in the name or where it is, or the name is inside what was typed', () => {
    expect(plainMatch('kyoto obuya', 'Obuya', 'Nakagyo Ward, Kyoto, Japan')).toBe(true)
    expect(plainMatch('trefac style koenji', 'Trefac Style Koenji', 'Suginami City, Tokyo')).toBe(true)
    expect(plainMatch('cut hair at assort', 'ASSORT', 'Shibuya, Tokyo')).toBe(true)
    expect(plainMatch("kyle's good finds", 'Kyles Good Finds', 'Nakano')).toBe(true)
    expect(plainMatch('2nd street', '2nd STREET Shibuya', 'Tokyo')).toBe(true)
  })
  it('a different place sharing a word is not it', () => {
    expect(plainMatch('kyoto obuya', 'Kyoto Station', 'Shimogyo Ward, Kyoto')).toBe(false)
    expect(plainMatch('iyoshi cola', 'Coca-Cola Store', 'Tokyo')).toBe(false)
    expect(plainMatch('lunch', 'Lunch Box Cafe', 'Tokyo')).toBe(false)
  })
})

describe('quietFind', () => {
  it('with google, the first suggestion that plainly matches, near that day', async () => {
    g.suggest.mockResolvedValue([sug('a', 'Kyoto Station', 'Kyoto'), sug('b', 'Obuya', 'Nakagyo Ward, Kyoto')])
    const found = place({ name: 'Obuya', lat: 35.01, lng: 135.76, gid: 'b' })
    g.pick.mockResolvedValue(found)
    expect(await quietFind('kyoto obuya', kyoto)).toEqual(found)
    expect(g.pick).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }), expect.any(String))
  })

  it('nothing plainly matching asks google for nothing more, and finds nothing', async () => {
    g.suggest.mockResolvedValue([sug('a', 'Kyoto Station', 'Kyoto')])
    expect(await quietFind('kyoto obuya', kyoto)).toBeNull()
    expect(g.pick).not.toHaveBeenCalled()
  })

  it('a match far from that day is not it', async () => {
    g.suggest.mockResolvedValue([sug('b', 'Obuya', 'Kyoto')])
    g.pick.mockResolvedValue(place({ name: 'Obuya', lat: 1.3, lng: 103.8 }))
    expect(await quietFind('kyoto obuya', kyoto)).toBeNull()
  })

  it('without google, openstreetmap spots close by with the same name', async () => {
    g.on = false
    photon.spots.mockResolvedValue([place({ name: 'Kura Sushi', lat: 35.01, lng: 135.76 })])
    expect((await quietFind('kura sushi', kyoto))?.name).toBe('Kura Sushi')
  })

  it('with nowhere to aim near, it does not guess', async () => {
    expect(await quietFind('kyoto obuya', null)).toBeNull()
    expect(g.suggest).not.toHaveBeenCalled()
  })
})
