import { walkSeconds, walkLabel } from '../../src/lib/walk'
import { place } from '../factories'

afterEach(() => vi.restoreAllMocks())

it('walk label rounds and hides long walks', () => {
  expect(walkLabel(530)).toBe('9 min walk')
  expect(walkLabel(20)).toBe('1 min walk')
  expect(walkLabel(7300)).toBeNull()
  expect(walkLabel(null)).toBeNull()
})

it('walk is null without coordinates and does not fetch', async () => {
  const spy = vi.spyOn(globalThis, 'fetch')
  expect(await walkSeconds(place({ lat: null, lng: null }), place())).toBeNull()
  expect(spy).not.toHaveBeenCalled()
})

it('walk asks the foot router and caches the result', async () => {
  const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ code: 'Ok', routes: [{ duration: 530.4 }] })))
  const a = place({ lat: 66.507912345, lng: 25.7287 }), b = place({ lat: 66.5, lng: 25.73 })
  expect(await walkSeconds(a, b)).toBe(530.4)
  expect(String(spy.mock.calls[0][0])).toBe('https://routing.openstreetmap.de/routed-foot/route/v1/foot/25.7287,66.507912345;25.73,66.5?overview=false')
  expect(localStorage.getItem('walk:66.50791,25.7287;66.5,25.73')).toBe('530.4')
  expect(await walkSeconds(a, b)).toBe(530.4)
  expect(spy).toHaveBeenCalledTimes(1)
})

it('a failed walk is null and not cached', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'))
  expect(await walkSeconds(place(), place({ lat: 51 }))).toBeNull()
  expect(Object.keys(localStorage).filter((k) => k.startsWith('walk:'))).toEqual([])
})
