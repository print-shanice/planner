import { renderHook, waitFor } from '@testing-library/react'
import { stop } from '../factories'

const m = vi.hoisted(() => ({ save: vi.fn(), refetch: vi.fn() }))
vi.mock('../../src/lib/queries', () => ({ useSave: () => ({ mutateAsync: m.save }) }))
vi.mock('../../src/lib/offline', () => ({ useCanEdit: () => true }))
vi.mock('../../src/lib/google/places', async (orig) => ({ ...(await orig<typeof import('../../src/lib/google/places')>()), refetchPlace: m.refetch }))
import { useRefreshPlaces } from '../../src/lib/google/refresh'

afterEach(() => vi.unstubAllEnvs())

it('asks google again for coordinates kept 30 days or more, by place id, once per visit', async () => {
  vi.stubEnv('VITE_GOOGLE_MAPS_KEY', 'k')
  m.save.mockResolvedValue({}); m.refetch.mockImplementation(async (p) => ({ ...p, lat: 2, at: 'today' }))
  const old = stop({ id: 'old', place: { name: 'cafe', lat: 1, lng: 1, gid: 'g1', at: '2020-01-01' } })
  const fresh = stop({ id: 'new', place: { name: 'cafe', lat: 1, lng: 1, gid: 'g2', at: '2999-01-01' } })
  const mine = stop({ id: 'osm', place: { name: 'park', lat: 1, lng: 1 } })
  const { rerender } = renderHook(({ s }) => useRefreshPlaces(s), { initialProps: { s: [old, fresh, mine] } })
  await waitFor(() => expect(m.save).toHaveBeenCalledWith({ id: 'old', place: expect.objectContaining({ lat: 2, gid: 'g1' }) }))
  rerender({ s: [old, fresh, mine] })
  expect(m.refetch).toHaveBeenCalledTimes(1)
})

it('does nothing without google', () => {
  vi.stubEnv('VITE_GOOGLE_MAPS_KEY', '')
  m.refetch.mockReset()
  renderHook(() => useRefreshPlaces([stop({ place: { name: 'x', lat: 1, lng: 1, gid: 'g', at: '2020-01-01' } })]))
  expect(m.refetch).not.toHaveBeenCalled()
})
