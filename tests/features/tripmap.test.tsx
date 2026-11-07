import { act, render, screen } from '@testing-library/react'

const mk = vi.hoisted(() => {
  const maps: any[] = []
  class FakeMap {
    handlers: Record<string, ((e?: unknown) => void)[]> = {}
    touchZoomRotate = { disableRotation() {} }
    constructor() { maps.push(this) }
    on(ev: string, a: unknown, b?: unknown) { const fn = (typeof a === 'function' ? a : b) as () => void; (this.handlers[ev] ??= []).push(fn); return this }
    fire(ev: string) { for (const f of this.handlers[ev] ?? []) f() }
    addControl() {} addImage() {} addSource() {} addLayer() {} getLayer() { return true } setFilter() {}
    getSource() { return { setData() {} } } fitBounds() {} jumpTo() {} remove() {} isStyleLoaded() { return false }
    getCanvas() { return { style: {} } } getCenter() { return { lng: 0, lat: 0 } }
  }
  class GeolocateControl {}
  return { maps, FakeMap, GeolocateControl }
})
vi.mock('maplibre-gl', () => ({ default: { Map: mk.FakeMap, GeolocateControl: mk.GeolocateControl } }))

import { TripMap } from '../../src/features/map/TripMap'

// jsdom has no canvas; the map draws its bookmark icon on one when it loads
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(new Proxy({}, { get: () => () => {}, set: () => true }) as never)
})

const empty = { type: 'FeatureCollection', features: [] } as never

it('the map says it is loading until its first draw', () => {
  render(<TripMap data={{ pins: empty, lines: empty, saved: empty }} fitKey="t|all" fallback={null} focus={null} onPick={() => {}} onEmpty={() => {}} />)
  expect(screen.getByRole('status')).toHaveTextContent('loading map')
  act(() => { mk.maps.at(-1).fire('load') })
  expect(screen.queryByText('loading map')).toBeNull()
})

it('the map says where it is looking as soon as it has drawn', () => {
  const onCenter = vi.fn()
  render(<TripMap data={{ pins: empty, lines: empty, saved: empty }} fitKey="t|all" fallback={null} focus={null} onPick={() => {}} onEmpty={() => {}} onCenter={onCenter} />)
  const m = mk.maps.at(-1)
  m.getZoom = () => 11
  act(() => { m.fire('load') })
  expect(onCenter).toHaveBeenCalledWith({ lng: 0, lat: 0, zoom: 11 })
})
