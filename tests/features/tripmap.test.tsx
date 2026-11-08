import { act, fireEvent, render, screen } from '@testing-library/react'

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
  class Marker {
    el: HTMLElement
    constructor(o: { element: HTMLElement }) { this.el = o.element }
    setLngLat() { return this }
    addTo() { document.body.appendChild(this.el); this.el.setAttribute('aria-label', 'map marker'); return this }
    remove() { this.el.remove() }
  }
  return { maps, FakeMap, GeolocateControl, Marker }
})
vi.mock('maplibre-gl', () => ({ default: { Map: mk.FakeMap, GeolocateControl: mk.GeolocateControl, Marker: mk.Marker } }))

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

it('side-trip pins are named buttons that open the trip', () => {
  const onTrip = vi.fn()
  const overview = { home: { name: 'eindhoven', at: [5.5, 51.4] as [number, number] }, sides: [{ id: 'lap', name: 'lapland', dates: '7 – 11 feb', color: 'var(--g1)', at: [25.7, 66.5] as [number, number] }], lines: empty }
  render(<TripMap data={{ pins: empty, ends: empty, beds: empty, names: empty, lines: empty, saved: empty }} overview={overview} onTrip={onTrip} fitKey="t|all" fallback={null} focus={null} onPick={() => {}} onEmpty={() => {}} />)
  act(() => { mk.maps.at(-1).fire('load') })
  // a click on a side-trip pin must not also reach the map's own click (find the place here)
  const reached = vi.fn()
  document.addEventListener('click', reached)
  fireEvent.click(screen.getByRole('button', { name: 'lapland, 7 – 11 feb' }))
  document.removeEventListener('click', reached)
  expect(reached).not.toHaveBeenCalled()
  expect(onTrip).toHaveBeenCalledWith('lap')
  expect(mk.maps.at(-1).fits[0]).toEqual([[5.5, 51.4], [25.7, 66.5]])
})

it('the home pin is labelled with the home name, not "map marker"', () => {
  const overview = { home: { name: 'eindhoven', at: [5.5, 51.4] as [number, number] }, sides: [], lines: empty }
  render(<TripMap data={{ pins: empty, ends: empty, beds: empty, names: empty, lines: empty, saved: empty }} overview={overview} fitKey="t|all" fallback={null} focus={null} onPick={() => {}} onEmpty={() => {}} />)
  act(() => { mk.maps.at(-1).fire('load') })
  expect(document.querySelector('[aria-label="eindhoven"]')).not.toBeNull()
})
