import { act, render, screen } from '@testing-library/react'

const mk = vi.hoisted(() => {
  const maps: any[] = []
  class FakeMap {
    handlers: Record<string, ((e?: unknown) => void)[]> = {}
    touchZoomRotate = { disableRotation() {} }
    constructor() { maps.push(this) }
    on(ev: string, a: unknown, b?: unknown) { const fn = (typeof a === 'function' ? a : b) as () => void; (this.handlers[ev] ??= []).push(fn); return this }
    fire(ev: string) { for (const f of this.handlers[ev] ?? []) f() }
    sources: string[] = []
    layers: string[] = []
    fits: unknown[] = []
    addControl() {} addImage() {} addSource(id: string) { this.sources.push(id) } addLayer(l: { id: string }) { this.layers.push(l.id) } getLayer() { return true } setFilter() {}
    getSource() { return { setData() {} } } fitBounds(b: unknown) { this.fits.push(b) } jumpTo() {} remove() {} isStyleLoaded() { return false }
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
  render(<TripMap data={{ pins: empty, ends: empty, beds: empty, names: empty, lines: empty, saved: empty }} fitKey="t|all" fallback={null} focus={null} onPick={() => {}} onEmpty={() => {}} />)
  expect(screen.getByRole('status')).toHaveTextContent('loading map')
  act(() => { mk.maps.at(-1).fire('load') })
  expect(screen.queryByText('loading map')).toBeNull()
})

it('the map says where it is looking as soon as it has drawn', () => {
  const onCenter = vi.fn()
  render(<TripMap data={{ pins: empty, ends: empty, beds: empty, names: empty, lines: empty, saved: empty }} fitKey="t|all" fallback={null} focus={null} onPick={() => {}} onEmpty={() => {}} onCenter={onCenter} />)
  const m = mk.maps.at(-1)
  m.getZoom = () => 11
  act(() => { m.fire('load') })
  expect(onCenter).toHaveBeenCalledWith({ lng: 0, lat: 0, zoom: 11 })
})

it('the map adds the end, bed and name layers', () => {
  render(<TripMap data={{ pins: empty, ends: empty, beds: empty, names: empty, lines: empty, saved: empty }} fitKey="t|all" fallback={null} focus={null} onPick={() => {}} onEmpty={() => {}} />)
  const m = mk.maps.at(-1)
  act(() => { m.fire('load') })
  expect(m.sources).toEqual(expect.arrayContaining(['ends', 'beds', 'pin-names']))
  const at = (id: string) => m.layers.indexOf(id)
  expect(at('journey-ends')).toBeGreaterThan(-1)
  expect(at('journey-ends')).toBeLessThan(at('beds'))
  expect(at('beds')).toBeLessThan(at('pin-names'))
  expect(at('pin-names')).toBeLessThan(at('pins'))
})

it('ideas are not part of the fit when the day has stops', () => {
  const pt = (c: number[]) => ({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { id: 'a' }, geometry: { type: 'Point', coordinates: c } }] }) as never
  render(<TripMap data={{ pins: pt([25.7, 66.5]), ends: empty, beds: empty, names: empty, lines: empty, saved: pt([-70, -30]) }} fitKey="t|all" fallback={null} focus={null} onPick={() => {}} onEmpty={() => {}} />)
  const m = mk.maps.at(-1)
  act(() => { m.fire('load') })
  expect(m.fits[0]).toEqual([[25.7, 66.5], [25.7, 66.5]])
})
