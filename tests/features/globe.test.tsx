import { act, fireEvent, render, screen } from '@testing-library/react'
import type { GlobePin } from '../../src/lib/countries'

// a stand-in for maplibre: records what the globe asks for and lets tests fire map events
const mk = vi.hoisted(() => {
  const maps: FakeMap[] = []
  class FakeMap {
    opts: any
    container: HTMLElement
    handlers: Record<string, ((e?: any) => void)[]> = {}
    zoom = 0.9
    center = { lng: 10, lat: 30 }
    hit: string | null = null
    touchZoomRotate = { disableRotation: vi.fn() }
    transform = { isLocationOccluded: vi.fn((_: { lng: number; lat: number }) => false) }
    setPaintProperty = vi.fn()
    zoomIn = vi.fn()
    zoomOut = vi.fn()
    zoomTo = vi.fn((z: number) => { this.zoom = z })
    jumpTo = vi.fn((o: { center: [number, number] }) => { this.center = { lng: o.center[0], lat: o.center[1] } })
    remove = vi.fn()
    constructor(opts: any) { this.opts = opts; this.container = opts.container; maps.push(this) }
    on(type: string, a: any, b?: any) { (this.handlers[type] ??= []).push(b ?? a); return this }
    once(type: string, fn: (e?: any) => void) { return this.on(type, fn) }
    fire(type: string, e: any = {}) { for (const fn of this.handlers[type] ?? []) fn(e) }
    getCanvas() { return { style: {} as Record<string, string> } }
    getCenter() { return this.center }
    getZoom() { return this.zoom }
    isMoving() { return false }
    isStyleLoaded() { return true }
    project(ll: { lng: number; lat: number }) { return { x: ll.lng * 10, y: ll.lat * 10 } }
    queryRenderedFeatures() { return this.hit ? [{ properties: { ISO_A2: this.hit } }] : [] }
  }
  class FakeMarker {
    el: HTMLElement
    ll = { lng: 0, lat: 0 }
    constructor(o: { element: HTMLElement }) { this.el = o.element }
    setLngLat(ll: [number, number]) { this.ll = { lng: ll[0], lat: ll[1] }; return this }
    getLngLat() { return this.ll }
    // like maplibre, adding a marker stamps a generic label on it
    addTo(m: FakeMap) { this.el.setAttribute('aria-label', 'Map marker'); m.container.appendChild(this.el); return this }
    remove() { this.el.remove(); return this }
  }
  return { maps, FakeMap, FakeMarker }
})
vi.mock('maplibre-gl', () => ({ default: { Map: mk.FakeMap, Marker: mk.FakeMarker } }))

// animation frames run only when a test calls tick()
const frames = new Map<number, FrameRequestCallback>()
let nextFrame = 0
const tick = () => { const queued = [...frames.values()]; frames.clear(); for (const cb of queued) cb(0) }
beforeEach(() => {
  frames.clear()
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.set(++nextFrame, cb); return nextFrame })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id) })
})
afterEach(() => vi.unstubAllGlobals())

import { Globe, fillFor } from '../../src/features/home/Globe'
import { GlobeTip, cityLine } from '../../src/features/home/GlobeTip'

const portugal: GlobePin = { code: 'PT', name: 'Portugal', status: 'been', cities: ['Lisbon', 'Sintra'], lng: -9, lat: 39 }
const france: GlobePin = { code: 'FR', name: 'France', status: 'planned', cities: ['Paris'], lng: 2, lat: 49 }
const status = () => new Map<string, 'been' | 'planned'>([['PT', 'been'], ['FR', 'planned']])

// jsdom has no PointerEvent, so pointerType is added by hand
function pointer(el: Element, type: string, pointerType: string) {
  const e = new MouseEvent(type, { bubbles: type === 'pointerdown', cancelable: true })
  Object.defineProperty(e, 'pointerType', { value: pointerType })
  fireEvent(el, e)
}

function show(pins: GlobePin[] = [portugal, france]) {
  const onCountry = vi.fn()
  const view = render(<Globe status={status()} pins={pins} onCountry={onCountry} />)
  const m = mk.maps[mk.maps.length - 1]
  act(() => m.fire('load'))
  const box = view.container.querySelector('.globe')!
  return { m, onCountry, box, view }
}

const tip = () => screen.queryByRole('tooltip')

it('colours been countries red and planned ones pale red', () => {
  const tokens: Record<string, string> = { '--been': 'RED', '--been-soft': 'PALE', '--map-land': 'LAND' }
  const spy = vi.spyOn(window, 'getComputedStyle').mockReturnValue({ getPropertyValue: (n: string) => tokens[n] ?? '' } as unknown as CSSStyleDeclaration)
  expect(fillFor(status())).toEqual(['case',
    ['in', ['get', 'ISO_A2'], ['literal', ['PT']]], 'RED',
    ['in', ['get', 'ISO_A2'], ['literal', ['FR']]], 'PALE',
    'LAND',
  ])
  spy.mockRestore()
})

it('shows one pin per country, solid when been and hollow when planned', () => {
  show()
  expect(screen.getByRole('button', { name: 'Portugal' })).toHaveAttribute('data-status', 'been')
  expect(screen.getByRole('button', { name: 'France' })).toHaveAttribute('data-status', 'planned')
})

it('hovering a pin shows the country and its cities, leaving hides it', () => {
  show()
  const pin = screen.getByRole('button', { name: 'Portugal' })
  pointer(pin, 'pointerenter', 'mouse')
  expect(tip()).toHaveTextContent('Portugal')
  expect(tip()).toHaveTextContent('Lisbon · Sintra')
  expect(pin).toHaveAttribute('aria-describedby', tip()!.id)
  pointer(pin, 'pointerleave', 'mouse')
  expect(tip()).toBeNull()
})

it('the tip sits on its pin', () => {
  show()
  act(() => screen.getByRole('button', { name: 'Portugal' }).focus())
  expect(tip()).toHaveStyle({ left: '-90px', top: '390px' })
})

it('keyboard focus shows the tip too', () => {
  show()
  act(() => screen.getByRole('button', { name: 'France' }).focus())
  expect(tip()).toHaveTextContent('France')
})

it('clicking a pin opens the country', () => {
  const { onCountry } = show()
  fireEvent.click(screen.getByRole('button', { name: 'Portugal' }))
  expect(onCountry).toHaveBeenCalledWith('PT')
})

it('on a phone the first tap shows the tip and the second opens the country', () => {
  const { onCountry } = show()
  const pin = screen.getByRole('button', { name: 'Portugal' })
  pointer(pin, 'pointerdown', 'touch')
  fireEvent.click(pin)
  expect(tip()).toHaveTextContent('Portugal')
  expect(onCountry).not.toHaveBeenCalled()
  pointer(pin, 'pointerdown', 'touch')
  fireEvent.click(pin)
  expect(onCountry).toHaveBeenCalledWith('PT')
})

it('tapping a coloured country works like its pin, other countries do nothing', () => {
  const { m, onCountry, box } = show()
  m.hit = 'PT'
  act(() => m.fire('click', { point: { x: 0, y: 0 }, originalEvent: { target: box } }))
  expect(onCountry).toHaveBeenCalledWith('PT')
  onCountry.mockClear()
  m.hit = 'DE'
  act(() => m.fire('click', { point: { x: 0, y: 0 }, originalEvent: { target: box } }))
  expect(onCountry).not.toHaveBeenCalled()
})

it('tapping empty globe closes the tip', () => {
  const { m, box } = show()
  const pin = screen.getByRole('button', { name: 'Portugal' })
  pointer(pin, 'pointerdown', 'touch')
  fireEvent.click(pin)
  expect(tip()).not.toBeNull()
  act(() => m.fire('click', { point: { x: 0, y: 0 }, originalEvent: { target: box } }))
  expect(tip()).toBeNull()
})

it('pins on the far side of the globe are hidden and close their tip', () => {
  const { m, box } = show()
  act(() => screen.getByRole('button', { name: 'France' }).focus())
  m.transform.isLocationOccluded.mockImplementation((ll) => ll.lng === 2)
  act(() => m.fire('move'))
  // a hidden element has no accessible name, so find the pins by their label
  const pin = (name: string) => box.querySelector<HTMLElement>(`.globe-pin[aria-label="${name}"]`)!
  expect(pin('Portugal').style.visibility).toBe('')
  expect(pin('France').style.visibility).toBe('hidden')
  expect(screen.queryByRole('button', { name: 'France' })).toBeNull()
  expect(tip()).toBeNull()
})

it('keeps the tip open when pins are redrawn', () => {
  const { view } = show()
  act(() => screen.getByRole('button', { name: 'Portugal' }).focus())
  view.rerender(<Globe status={status()} pins={[{ ...portugal }, { ...france }]} onCountry={() => {}} />)
  expect(tip()).toHaveTextContent('Portugal')
  expect(screen.getAllByRole('button', { name: 'Portugal' })).toHaveLength(1)
})

it('keeps a tip near the edge inside the globe', () => {
  render(<GlobeTip id="t" pin={portugal} x={20} y={100} width={400} />)
  expect(screen.getByRole('tooltip')).toHaveStyle({ left: '110px', top: '100px' })
})

it('long city lists are shortened', () => {
  expect(cityLine(['a', 'b', 'c', 'd', 'e', 'f'])).toBe('a · b · c · d +2')
  expect(cityLine(['a', 'b'])).toBe('a · b')
})

it('zoom buttons zoom the globe', () => {
  const { m } = show()
  fireEvent.click(screen.getByRole('button', { name: 'zoom in' }))
  fireEvent.click(screen.getByRole('button', { name: 'zoom out' }))
  expect(m.zoomIn).toHaveBeenCalledTimes(1)
  expect(m.zoomOut).toHaveBeenCalledTimes(1)
})

it('turns until you press pause, and play starts it again', () => {
  const { m } = show()
  const spin = screen.getByRole('button', { name: 'spin' })
  expect(spin).toHaveAttribute('aria-pressed', 'true')
  act(tick)
  expect(m.jumpTo.mock.calls[0][0].center[0]).toBeCloseTo(10.04)
  fireEvent.click(spin)
  expect(spin).toHaveAttribute('aria-pressed', 'false')
  m.jumpTo.mockClear()
  act(tick)
  expect(m.jumpTo).not.toHaveBeenCalled()
  fireEvent.click(spin)
  act(tick)
  expect(m.jumpTo).toHaveBeenCalled()
})

it('dragging or zooming stops the spin', () => {
  const { m } = show()
  act(() => m.fire('dragstart'))
  expect(screen.getByRole('button', { name: 'spin' })).toHaveAttribute('aria-pressed', 'false')
  fireEvent.click(screen.getByRole('button', { name: 'spin' }))
  act(() => m.fire('zoomstart'))
  expect(screen.getByRole('button', { name: 'spin' })).toHaveAttribute('aria-pressed', 'false')
})

it('an open tip holds the globe still without stopping the spin', () => {
  const { m } = show()
  act(() => screen.getByRole('button', { name: 'Portugal' }).focus())
  act(tick)
  expect(m.jumpTo).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'spin' })).toHaveAttribute('aria-pressed', 'true')
})

it('starts still when the system asks for less motion', () => {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') }))
  show()
  expect(screen.getByRole('button', { name: 'spin' })).toHaveAttribute('aria-pressed', 'false')
})

it('a trackpad pinch zooms the globe, a plain scroll is left to the page', () => {
  const { m, view } = show()
  const wrap = view.container.querySelector('.globe-wrap')!
  const pinch = new WheelEvent('wheel', { ctrlKey: true, deltaY: -100, cancelable: true, bubbles: true })
  wrap.dispatchEvent(pinch)
  expect(pinch.defaultPrevented).toBe(true)
  expect(m.zoomTo.mock.calls[0][0]).toBeCloseTo(1.9)
  const scroll = new WheelEvent('wheel', { deltaY: 100, cancelable: true, bubbles: true })
  wrap.dispatchEvent(scroll)
  expect(scroll.defaultPrevented).toBe(false)
  expect(m.zoomTo).toHaveBeenCalledTimes(1)
})

it('a pinch on the globe never zooms the page in safari', () => {
  const { view } = show()
  const wrap = view.container.querySelector('.globe-wrap')!
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    const e = new Event(type, { cancelable: true })
    wrap.dispatchEvent(e)
    expect(e.defaultPrevented).toBe(true)
  }
})
