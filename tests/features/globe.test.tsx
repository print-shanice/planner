import { act, fireEvent, render, screen } from '@testing-library/react'
import { existsSync, readFileSync } from 'node:fs'
import type { GlobePin } from '../../src/lib/countries'

// a stand-in for maplibre: records what the globe asks for and lets tests fire map events
const mk = vi.hoisted(() => {
  const maps: FakeMap[] = []
  const markers: FakeMarker[] = []
  class FakeMap {
    opts: any
    container: HTMLElement
    handlers: Record<string, ((e?: any) => void)[]> = {}
    zoom = 0.9
    center = { lng: 10, lat: 30 }
    hit: string | null = null
    sources: Record<string, { setData: ReturnType<typeof vi.fn> }> = {}
    touchZoomRotate = { disableRotation: vi.fn() }
    transform = { isLocationOccluded: vi.fn((_: { lng: number; lat: number }) => false) }
    setPaintProperty = vi.fn()
    setFilter = vi.fn()
    addImage = vi.fn()
    hasImage = vi.fn(() => false)
    zoomIn = vi.fn()
    zoomOut = vi.fn()
    zoomTo = vi.fn((z: number) => { this.fire('zoomstart'); this.zoom = z })
    easeTo = vi.fn((o: { center: { lng: number; lat: number } }) => { this.center = o.center; this.fire('move'); this.fire('moveend') })
    jumpTo = vi.fn((o: { center: [number, number] }) => { this.center = { lng: o.center[0], lat: o.center[1] } })
    flyTo = vi.fn((o: { center: [number, number]; zoom: number; duration?: number }) => { this.zoom = o.zoom; this.center = { lng: o.center[0], lat: o.center[1] }; this.fire('move') })
    setCenter = vi.fn((c: [number, number]) => { this.center = { lng: c[0], lat: c[1] }; this.fire('move') })
    remove = vi.fn()
    constructor(opts: any) { this.opts = opts; this.container = opts.container; this.center = { lng: opts.center[0], lat: opts.center[1] }; maps.push(this) }
    getSource(id: string) { return (this.sources[id] ??= { setData: vi.fn() }) }
    on(type: string, a: any, b?: any) { (this.handlers[type] ??= []).push(b ?? a); return this }
    once(type: string, fn: (e?: any) => void) {
      const wrapped = (e?: any) => { this.handlers[type] = this.handlers[type].filter((f) => f !== wrapped); fn(e) }
      return this.on(type, wrapped)
    }
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
    anchor?: string
    ll = { lng: 0, lat: 0 }
    constructor(o: { element: HTMLElement; anchor?: string }) { this.el = o.element; this.anchor = o.anchor; markers.push(this) }
    setLngLat(ll: [number, number]) { this.ll = { lng: ll[0], lat: ll[1] }; return this }
    getLngLat() { return this.ll }
    // like maplibre, adding a marker stamps a generic label on it
    addTo(m: FakeMap) { this.el.setAttribute('aria-label', 'Map marker'); m.container.appendChild(this.el); return this }
    remove() { this.el.remove(); return this }
  }
  return { maps, markers, FakeMap, FakeMarker }
})
vi.mock('maplibre-gl', () => ({ default: { Map: mk.FakeMap, Marker: mk.FakeMarker } }))

// animation frames run only when a test calls tick() or play()
const frames = new Map<number, FrameRequestCallback>()
let nextFrame = 0
let now = 0
const tick = (t: number) => { const queued = [...frames.values()]; frames.clear(); for (const cb of queued) cb(t) }
// a stretch of smooth frames, 50ms apart
const play = (ms: number) => act(() => { for (let i = 0; i < ms / 50; i++) { now += 50; tick(now) } })
beforeEach(() => {
  frames.clear()
  now = 0
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

// most tests look at a globe zoomed in far enough for its pins; OUT is the globe zoomed out, where it spins and pins hide
const IN = 3
const OUT = 0.9
function show(pins: GlobePin[] = [portugal, france], zoom = IN) {
  const onCountry = vi.fn()
  const view = render(<Globe status={status()} pins={pins} onCountry={onCountry} />)
  const m = mk.maps[mk.maps.length - 1]
  act(() => m.fire('load'))
  m.zoom = zoom
  act(() => m.fire('move'))
  const box = view.container.querySelector('.globe')!
  return { m, onCountry, box, view }
}

const tip = () => screen.queryByRole('tooltip')

it('colours been countries red, planned ones pale red, and the rest sage land; the reds soften up close', () => {
  const tokens: Record<string, string> = { '--been': 'RED', '--been-soft': 'PALE', '--been-near': 'SOFT RED', '--been-soft-near': 'PALER', '--globe-land': 'LAND' }
  const spy = vi.spyOn(window, 'getComputedStyle').mockReturnValue({ getPropertyValue: (n: string) => tokens[n] ?? '' } as unknown as CSSStyleDeclaration)
  let fill: unknown
  try { fill = fillFor(status()) } finally { spy.mockRestore() }
  const been = ['in', ['get', 'ISO_A2'], ['literal', ['PT']]]
  const planned = ['in', ['get', 'ISO_A2'], ['literal', ['FR']]]
  expect(fill).toEqual(['interpolate', ['linear'], ['zoom'],
    2.4, ['case', been, 'RED', planned, 'PALE', 'LAND'],
    3.6, ['case', been, 'SOFT RED', planned, 'PALER', 'LAND'],
  ])
})

it('a red edge follows the countries you have been to', () => {
  const { m, view } = show()
  const edge = m.opts.style.layers.find((l: any) => l.id === 'been-edge')
  expect(edge.filter).toEqual(['in', ['get', 'ISO_A2'], ['literal', ['PT']]])
  view.rerender(<Globe status={new Map([['PT', 'been'], ['ES', 'been']])} pins={[portugal]} onCountry={() => {}} />)
  expect(m.setFilter).toHaveBeenLastCalledWith('been-edge', ['in', ['get', 'ISO_A2'], ['literal', ['PT', 'ES']]])
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

it('a trackpad pinch zooms the globe, a plain scroll is left to the page', () => {
  const { m, view } = show(undefined, OUT)
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

it('has no spin or zoom buttons', () => {
  show()
  expect(screen.queryByRole('button', { name: 'spin' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'zoom in' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'zoom out' })).toBeNull()
})

describe('spinning', () => {
  it('turns slowly on its own while zoomed out, about 4° a second', () => {
    const { m } = show(undefined, OUT)
    play(1000)
    expect(m.center.lng).toBeCloseTo(-7.5, 0)
    expect(m.center.lat).toBe(44)
  })

  it('holds still once names show, so they can be read', () => {
    const { m } = show()
    m.zoom = 2.4
    play(1000)
    expect(m.center.lng).toBe(-3.5)
  })

  it('stops while you hold it and starts again a few seconds after you let go', () => {
    const { m, view } = show(undefined, OUT)
    pointer(view.container.querySelector('.globe-wrap')!, 'pointerdown', 'mouse')
    play(1000)
    expect(m.center.lng).toBe(-3.5)
    fireEvent(window, new MouseEvent('pointerup'))
    play(2900)
    expect(m.center.lng).toBe(-3.5)
    play(1000)
    expect(m.center.lng).toBeLessThan(-5)
  })

  it('a trackpad pinch pauses it too', () => {
    const { m, view } = show(undefined, OUT)
    view.container.querySelector('.globe-wrap')!.dispatchEvent(new WheelEvent('wheel', { ctrlKey: true, deltaY: -10, cancelable: true, bubbles: true }))
    play(1000)
    expect(m.center.lng).toBe(-3.5)
  })

  it('never spins when the device asks for less motion', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q }))
    const { m } = show(undefined, OUT)
    play(1000)
    expect(m.center.lng).toBe(-3.5)
  })

  it('does not jump after the app was in the background', () => {
    const { m } = show(undefined, OUT)
    act(() => { tick(1000); tick(61000) })
    expect(Math.abs(m.center.lng + 3.5)).toBeLessThan(1)
  })

  it('stops for good when the globe goes away', () => {
    const { view } = show(undefined, OUT)
    view.unmount()
    expect(frames.size).toBe(0)
  })

  it('turning on its own never counts as someone turning it', () => {
    const { m, view } = show([], OUT)
    play(1000)
    view.rerender(<Globe status={status()} pins={[portugal]} onCountry={() => {}} />)
    expect(m.jumpTo).toHaveBeenLastCalledWith({ center: [-9, 39] })
  })
})

describe('names', () => {
  const nameLayers = (m: any, source?: string) => m.opts.style.layers.filter((l: any) => l.type === 'symbol' && (!source || l.source === source))

  it('shows no names zoomed out', () => {
    const { m } = show()
    expect(nameLayers(m).length).toBeGreaterThan(0)
    for (const l of nameLayers(m)) expect(l.minzoom).toBeGreaterThan(m.opts.zoom)
  })

  it('country names come in before city names', () => {
    const { m } = show()
    const first = (source: string) => Math.min(...nameLayers(m, source).map((l: any) => l.minzoom))
    expect(first('country-names')).toBeLessThan(first('cities'))
  })

  // maplibre places names from the top of the style down, and a placed name hides the ones it would overlap
  it('when names would overlap, the bigger place keeps its name', () => {
    const { m } = show()
    const at = (l: any) => m.opts.style.layers.indexOf(l)
    for (const source of ['country-names', 'cities']) {
      const layers = nameLayers(m, source)
      const biggest = layers.reduce((a: any, b: any) => (b.minzoom < a.minzoom ? b : a))
      const smallest = layers.reduce((a: any, b: any) => (b.minzoom > a.minzoom ? b : a))
      expect(at(biggest), source).toBeGreaterThan(at(smallest))
    }
  })

  it('zooms in far enough to read the smaller cities', () => {
    const { m } = show()
    const last = Math.max(...nameLayers(m, 'cities').map((l: any) => l.minzoom))
    expect(m.opts.maxZoom).toBeGreaterThanOrEqual(last + 0.5)
  })

  it('names are lettered from files the app carries, not a font server', () => {
    const { m } = show()
    expect(m.opts.style.glyphs).not.toMatch(/^https?:/)
    expect(m.opts.style.glyphs).toMatch(/globe\/fonts\/\{fontstack\}\/\{range\}\.pbf$/)
    for (const l of nameLayers(m)) {
      for (const font of l.layout['text-font']) expect(existsSync(`public/globe/fonts/${font}/0-255.pbf`), font).toBe(true)
    }
  })

  it('every letter in the place names has lettering in every font the globe uses', () => {
    const { m } = show()
    const fonts = new Set<string>(nameLayers(m).flatMap((l: any) => l.layout['text-font']))
    for (const file of ['country-names', 'cities']) {
      const data = JSON.parse(readFileSync(`public/globe/${file}.json`, 'utf8'))
      const ranges = new Set<number>()
      for (const f of data.features) for (const ch of f.properties.n as string) ranges.add(Math.floor(ch.codePointAt(0)! / 256) * 256)
      for (const font of fonts) for (const r of ranges) expect(existsSync(`public/globe/fonts/${font}/${r}-${r + 255}.pbf`), `${font} ${r}`).toBe(true)
    }
  })

  it('place names are lowercase, like the rest of the app', () => {
    for (const file of ['country-names', 'cities']) {
      const data = JSON.parse(readFileSync(`public/globe/${file}.json`, 'utf8'))
      const upper = data.features.map((f: any) => f.properties.n as string).filter((n: string) => n !== n.toLowerCase())
      expect(upper).toEqual([])
    }
  })

  it('draws the dot beside a city name itself: round, solid in the middle, clear at the corners', () => {
    const { m } = show()
    act(() => m.fire('styleimagemissing', { id: 'city-dot' }))
    expect(m.addImage).toHaveBeenCalledTimes(1)
    const [id, img, opts] = m.addImage.mock.calls[0]
    expect(id).toBe('city-dot')
    expect(opts).toEqual({ pixelRatio: 2 })
    const alpha = (x: number, y: number) => img.data[(y * img.width + x) * 4 + 3]
    const mid = Math.floor(img.width / 2)
    expect(alpha(mid, mid)).toBe(255)
    expect(alpha(0, 0)).toBe(0)
    act(() => m.fire('styleimagemissing', { id: 'someone-elses-icon' }))
    expect(m.addImage).toHaveBeenCalledTimes(1)
  })

  it('fetches nothing extra while zoomed out', () => {
    const { m } = show(undefined, OUT)
    expect(m.opts.style.sources['cities'].data.features).toEqual([])
    expect(m.opts.style.sources['country-names'].data.features).toEqual([])
    act(() => { m.zoom = 1.9; m.fire('zoom') })
    expect(m.sources['cities']).toBeUndefined()
  })

  it('loads detailed coastlines, country names and cities the first time you zoom in, once', () => {
    const { m } = show(undefined, OUT)
    act(() => { m.zoom = 2.1; m.fire('zoom') })
    expect(m.getSource('countries').setData).toHaveBeenCalledWith(expect.stringMatching(/globe\/countries-50m\.json$/))
    expect(m.getSource('country-names').setData).toHaveBeenCalledWith(expect.stringMatching(/globe\/country-names\.json$/))
    expect(m.getSource('cities').setData).toHaveBeenCalledWith(expect.stringMatching(/globe\/cities\.json$/))
    act(() => { m.zoom = 1.5; m.fire('zoom'); m.zoom = 3; m.fire('zoom') })
    expect(m.getSource('cities').setData).toHaveBeenCalledTimes(1)
  })
})

it('opens zoomed in on your places', () => {
  const { m } = show()
  expect(m.opts.zoom).toBe(1.7)
  expect(m.opts.center).toEqual([-3.5, 44])
})

it('with no places yet it opens on europe', () => {
  const { m } = show([])
  expect(m.opts.center).toEqual([10, 48])
})

it('places that load after the globe opens still get centred on', () => {
  const { m, view } = show([])
  view.rerender(<Globe status={status()} pins={[portugal]} onCountry={() => {}} />)
  expect(m.jumpTo).toHaveBeenLastCalledWith({ center: [-9, 39] })
})

it('never pulls the globe away from where someone turned it', () => {
  const { m, view } = show([])
  act(() => m.fire('dragstart'))
  view.rerender(<Globe status={status()} pins={[portugal]} onCountry={() => {}} />)
  expect(m.jumpTo).not.toHaveBeenCalled()
})

it('pins are pin shaped and point at the place', () => {
  show()
  const pin = screen.getByRole('button', { name: 'Portugal' })
  expect(pin.querySelector('svg')).not.toBeNull()
  expect(mk.markers.at(-1)!.anchor).toBe('bottom')
})

// safari's own pinch events carry a scale relative to where the pinch started
function gesture(el: Element, type: string, scale: number) {
  const e = new Event(type, { cancelable: true })
  Object.defineProperty(e, 'scale', { value: scale })
  el.dispatchEvent(e)
  return e
}
const touchPoints = (n: number) => Object.defineProperty(navigator, 'maxTouchPoints', { value: n, configurable: true })

describe('safari pinches', () => {
  beforeEach(() => { vi.stubGlobal('GestureEvent', class {}); touchPoints(0) })
  afterEach(() => touchPoints(0))

  it('a trackpad pinch in safari on a mac zooms the globe', () => {
    const { m, view } = show(undefined, OUT)
    const wrap = view.container.querySelector('.globe-wrap')!
    gesture(wrap, 'gesturestart', 1)
    const e = gesture(wrap, 'gesturechange', 2)
    expect(e.defaultPrevented).toBe(true)
    expect(m.zoomTo.mock.calls.at(-1)![0]).toBeCloseTo(1.9)
    gesture(wrap, 'gesturechange', 0.5)
    expect(m.zoomTo.mock.calls.at(-1)![0]).toBeCloseTo(0.6)
  })

  it('a ctrl+wheel copy of the same pinch is ignored, so it never zooms twice', () => {
    const { m, view } = show()
    const wrap = view.container.querySelector('.globe-wrap')!
    gesture(wrap, 'gesturestart', 1)
    wrap.dispatchEvent(new WheelEvent('wheel', { ctrlKey: true, deltaY: -100, cancelable: true, bubbles: true }))
    expect(m.zoomTo).not.toHaveBeenCalled()
    gesture(wrap, 'gestureend', 1)
    wrap.dispatchEvent(new WheelEvent('wheel', { ctrlKey: true, deltaY: -100, cancelable: true, bubbles: true }))
    expect(m.zoomTo).toHaveBeenCalledTimes(1)
  })

  it('on an iphone a pinch is left to the map, so it never zooms twice', () => {
    touchPoints(5)
    const { m, view } = show()
    const wrap = view.container.querySelector('.globe-wrap')!
    gesture(wrap, 'gesturestart', 1)
    expect(gesture(wrap, 'gesturechange', 2).defaultPrevented).toBe(true)
    expect(m.zoomTo).not.toHaveBeenCalled()
  })
})

it('a pin keeps keyboard focus when pins are redrawn', () => {
  const { view } = show()
  const pin = screen.getByRole('button', { name: 'Portugal' })
  act(() => pin.focus())
  view.rerender(<Globe status={status()} pins={[{ ...portugal, cities: ['Lisbon', 'Sintra', 'Porto'] }, { ...france }]} onCountry={() => {}} />)
  expect(document.activeElement).toBe(pin)
  expect(tip()).toHaveTextContent('Porto')
})

it('a pin that went away is removed, and a new one is added', () => {
  const { view } = show()
  view.rerender(<Globe status={status()} pins={[portugal, { code: 'ES', name: 'Spain', status: 'been', cities: [], lng: -4, lat: 40 }]} onCountry={() => {}} />)
  expect(screen.queryByRole('button', { name: 'France' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Spain' })).toBeInTheDocument()
})

it('a pinch counts as turning the globe, so places that arrive later do not re-centre it', () => {
  const { m, view } = show([])
  view.container.querySelector('.globe-wrap')!.dispatchEvent(new WheelEvent('wheel', { ctrlKey: true, deltaY: -100, cancelable: true, bubbles: true }))
  view.rerender(<Globe status={status()} pins={[portugal]} onCountry={() => {}} />)
  expect(m.jumpTo).not.toHaveBeenCalled()
})

it('escape closes the tip', () => {
  show()
  act(() => screen.getByRole('button', { name: 'Portugal' }).focus())
  expect(tip()).not.toBeNull()
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(tip()).toBeNull()
})

it('tapping outside the globe closes the tip', () => {
  show()
  const pin = screen.getByRole('button', { name: 'Portugal' })
  pointer(pin, 'pointerdown', 'touch')
  fireEvent.click(pin)
  expect(tip()).not.toBeNull()
  pointer(document.body, 'pointerdown', 'touch')
  expect(tip()).toBeNull()
})

it('tapping a country whose pin is behind the horizon turns the globe to it and shows the tip', () => {
  const { m, onCountry, box } = show()
  // portugal's pin is round the back until the globe turns
  let turned = false
  m.transform.isLocationOccluded.mockImplementation((ll) => ll.lng === -9 && !turned)
  m.easeTo.mockImplementation((o: any) => { turned = true; m.center = o.center; m.fire('move'); m.fire('moveend') })
  act(() => m.fire('move'))
  pointer(box, 'pointerdown', 'touch')
  m.hit = 'PT'
  act(() => m.fire('click', { point: { x: 0, y: 0 }, originalEvent: { target: box } }))
  expect(m.easeTo).toHaveBeenCalledWith(expect.objectContaining({ center: { lng: -9, lat: 39 } }))
  expect(tip()).toHaveTextContent('Portugal')
  expect(onCountry).not.toHaveBeenCalled()
})

it('the arrow stays on a narrow tip near the edge', () => {
  const spy = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(120)
  try {
    render(<GlobeTip id="t" pin={portugal} x={4} y={100} width={400} />)
    const el = screen.getByRole('tooltip')
    expect(el).toHaveStyle({ left: '60px' })
    expect(el.style.getPropertyValue('--arrow')).toBe('-46px')
  } finally { spy.mockRestore() }
})

describe('pins zoomed out', () => {
  const pinEl = (box: Element, name: string) => box.querySelector<HTMLElement>(`.globe-pin[aria-label="${name}"]`)!
  const countryNames = (m: any) => m.opts.style.layers.filter((l: any) => l.source === 'country-names')
  const click = (m: any, box: Element, lngLat = { lng: 0, lat: 0 }) =>
    act(() => m.fire('click', { point: { x: 0, y: 0 }, lngLat, originalEvent: { target: box } }))

  it('stay hidden while zoomed out, like the names', () => {
    const { box } = show(undefined, OUT)
    expect(screen.queryByRole('button', { name: 'Portugal' })).toBeNull()
    expect(pinEl(box, 'Portugal').style.visibility).toBe('hidden')
  })

  it('fade in exactly as the first country names do', () => {
    const { m, box } = show(undefined, OUT)
    // the first names' fade: ['interpolate', ['linear'], ['zoom'], from, 0, to, 1]
    const first = countryNames(m).reduce((a: any, b: any) => (b.minzoom < a.minzoom ? b : a))
    const [, , , from, , to] = first.paint['text-opacity']
    act(() => { m.zoom = from - 0.01; m.fire('move') })
    expect(pinEl(box, 'Portugal').style.visibility).toBe('hidden')
    act(() => { m.zoom = (from + to) / 2; m.fire('move') })
    expect(pinEl(box, 'Portugal').style.visibility).toBe('')
    expect(Number(pinEl(box, 'Portugal').style.opacity)).toBeCloseTo(0.5)
    act(() => { m.zoom = to; m.fire('move') })
    expect(screen.getByRole('button', { name: 'Portugal' })).toBeInTheDocument()
    expect(Number(pinEl(box, 'Portugal').style.opacity || 1)).toBe(1)
  })

  it('tapping a coloured country flies in to its pin, close enough to read every country name', () => {
    const { m, onCountry, box } = show(undefined, OUT)
    m.hit = 'PT'
    click(m, box)
    expect(m.flyTo).toHaveBeenCalledTimes(1)
    const to = m.flyTo.mock.calls[0][0]
    expect(to.center).toEqual([-9, 39])
    const lastName = Math.max(...countryNames(m).map((l: any) => l.paint['text-opacity'][5]))
    expect(to.zoom).toBeGreaterThanOrEqual(lastName)
    expect(to.duration).toBeGreaterThan(0)
    expect(onCountry).not.toHaveBeenCalled()
    expect(tip()).toBeNull()
    // once there, the pins show
    expect(screen.getByRole('button', { name: 'Portugal' })).toBeInTheDocument()
  })

  it('on a phone a tap flies in too, with no tip yet', () => {
    const { m, onCountry, box } = show(undefined, OUT)
    pointer(box, 'pointerdown', 'touch')
    m.hit = 'FR'
    click(m, box)
    expect(m.flyTo.mock.calls[0][0].center).toEqual([2, 49])
    expect(onCountry).not.toHaveBeenCalled()
    expect(tip()).toBeNull()
  })

  it('with reduced motion it jumps there instead of gliding', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q }))
    const { m, box } = show(undefined, OUT)
    m.hit = 'PT'
    click(m, box)
    expect(m.flyTo.mock.calls[0][0].duration).toBe(0)
  })

  it('tapping a country that is not coloured does nothing', () => {
    const { m, onCountry, box } = show(undefined, OUT)
    m.hit = 'DE'
    click(m, box)
    expect(m.flyTo).not.toHaveBeenCalled()
    expect(onCountry).not.toHaveBeenCalled()
  })

  it('a coloured country without a pin flies to where it was tapped', () => {
    const { m, box } = show([portugal], OUT)
    m.hit = 'FR'
    click(m, box, { lng: 2.5, lat: 46 })
    expect(m.flyTo.mock.calls[0][0].center).toEqual([2.5, 46])
  })
})
