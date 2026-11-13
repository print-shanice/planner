import { useEffect, useId, useRef, useState } from 'react'
import maplibregl, { type ExpressionSpecification, type GeoJSONSource, type LayerSpecification, type StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { GlobePin } from '../../lib/countries'
import { arc, type GlobeRoute, type LngLat } from '../../lib/travels'
import { iconPath } from '../../components/Icon'
import { GlobeTip } from './GlobeTip'
import { Loading } from '../../components/Loading'
import { openLayer } from '../../lib/layers'
import { modeIcon } from '../../lib/lineKind'
import type { Mode } from '../../lib/types'

type Status = Map<string, 'been' | 'planned'>
// routes: journeys to draw (an opened way of getting around); focus: a country to turn to and point at (a tapped passport stamp)
type Props = { status: Status; pins: GlobePin[]; onCountry: (code: string) => void; routes?: GlobeRoute[]; focus?: { code: string; n: number } | null }
type Placed = { pin: GlobePin; marker: maplibregl.Marker; el: HTMLButtonElement }

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()
const MIN_ZOOM = 0.6
const MAX_ZOOM = 7
const START_ZOOM = 1.7
const EUROPE: [number, number] = [10, 48]
// detailed coastlines, place names and cities load the first time someone zooms in this far
const DETAIL_FROM = 2
// the first names (and the pins) show here, fading in over FADE of a zoom level
const NAMES_FROM = 2.4
const FADE = 0.35
// names fade in by importance, biggest first: [shown from zoom, natural earth's own zoom for the place up to]
const COUNTRY_NAMES: [number, number][] = [[NAMES_FROM, 3], [3, 4], [3.6, 5], [4.2, 99]]
const CITY_NAMES: [number, number][] = [[4, 4.7], [4.8, 5.4], [5.6, 6.2], [6.4, 99]]
// zoomed out, a tap on a coloured country flies in this close: every country name has faded in by here
const CLOSE = 4.6
// the reds soften as names come in, so the names on them stay easy to read
const NEAR: [number, number] = [NAMES_FROM, 3.6]
// a gentle spin, one turn in about a minute and a half, only while zoomed out (it holds still once names show)
const SPIN = 4
const RESUME_MS = 3000
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }
const reduced = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const globeFile = (name: string) => `${import.meta.env.BASE_URL}globe/${name}`

// a glyph for how you went, sitting on the middle of its route: a plane, a train, a bus, a ferry
function glyphElement(mode: Mode): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'globe-glyph'
  el.setAttribute('aria-hidden', 'true')
  const name = modeIcon(mode)
  el.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${iconPath(name)}"/></svg>`
  return el
}

// a map pin whose point sits on the place
const PIN = '<svg viewBox="0 0 24 32" width="24" height="32" aria-hidden="true"><path d="M12 30.5s-9.5-9.9-9.5-17.6a9.5 9.5 0 0 1 19 0c0 7.7-9.5 17.6-9.5 17.6z"/><circle cx="12" cy="12.6" r="3.6"/></svg>'

// the globe opens on the middle of your places
function middleOf(pins: GlobePin[]): [number, number] {
  if (!pins.length) return EUROPE
  return [pins.reduce((n, p) => n + p.lng, 0) / pins.length, pins.reduce((n, p) => n + p.lat, 0) / pins.length]
}

const codes = (status: Status, which: 'been' | 'planned') => [...status].filter(([, s]) => s === which).map(([c]) => c)

// red = been there, pale red = planned; other land is sage, a map colour rather than a status.
// up close the reds soften so the names on them stay readable
export function fillFor(status: Status): ExpressionSpecification {
  const pick = (been: string, planned: string): ExpressionSpecification => ['case',
    ['in', ['get', 'ISO_A2'], ['literal', codes(status, 'been')]], been,
    ['in', ['get', 'ISO_A2'], ['literal', codes(status, 'planned')]], planned,
    css('--globe-land'),
  ]
  return ['interpolate', ['linear'], ['zoom'],
    NEAR[0], pick(css('--been'), css('--been-soft')),
    NEAR[1], pick(css('--been-near'), css('--been-soft-near')),
  ]
}

// once the red softens, a red edge keeps the countries you've been to clearly yours
const edgeFor = (status: Status): ExpressionSpecification => ['in', ['get', 'ISO_A2'], ['literal', codes(status, 'been')]]

const fadeIn = (from: number): ExpressionSpecification => ['interpolate', ['linear'], ['zoom'], from, 0, from + FADE, 1]
const halo = () => ({ 'text-halo-color': css('--globe-halo'), 'text-halo-width': 1, 'text-halo-blur': 0.6 })

// each band shows the places natural earth ranks between the previous band and this one
function bands(list: [number, number][]) {
  return list.map(([from, upTo], i) => ({ i, from, filter: ['all', ['>', ['get', 'z'], i ? list[i - 1][1] : -1], ['<=', ['get', 'z'], upTo]] as ExpressionSpecification }))
}

function nameLayers(): LayerSpecification[] {
  const countries = bands(COUNTRY_NAMES).map(({ i, from, filter }): LayerSpecification => ({
    id: `country-names-${i}`, type: 'symbol', source: 'country-names', minzoom: from, filter,
    layout: {
      'text-field': ['get', 'n'], 'text-font': ['hanken-600'],
      'text-size': ['interpolate', ['linear'], ['zoom'], NAMES_FROM, 11, 5, 13, 7, 15],
      'text-letter-spacing': 0.08, 'text-max-width': 7, 'text-padding': 6, 'symbol-sort-key': ['get', 'r'],
    },
    paint: { 'text-color': css('--ink-2'), ...halo(), 'text-opacity': fadeIn(from) },
  }))
  // a city's dot and name show together or not at all, so no dot is left without its name
  const cities = bands(CITY_NAMES).map(({ i, from, filter }): LayerSpecification => ({
    id: `city-names-${i}`, type: 'symbol', source: 'cities', minzoom: from, filter,
    layout: {
      'icon-image': ['case', ['has', 'c'], 'capital-dot', 'city-dot'],
      'text-field': ['get', 'n'], 'text-font': ['hanken-500'], 'text-size': ['case', ['has', 'c'], 13.5, 12],
      'text-variable-anchor': ['left', 'right', 'top', 'bottom'], 'text-radial-offset': 0.55, 'text-justify': 'auto',
      'text-padding': 4, 'symbol-sort-key': ['get', 'z'],
    },
    paint: { 'text-color': css('--ink'), ...halo(), 'text-opacity': fadeIn(from), 'icon-opacity': fadeIn(from) },
  }))
  // maplibre places names from the top of the style down, so the biggest places go last and win any overlap
  return [...countries.reverse(), ...cities.reverse()]
}

// a round ink dot with a white ring, drawn here so it needs no image file (pixel ratio 2)
function dot(radius: number) {
  const rgb = (name: string) => { const v = css(name).replace('#', ''); return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)) }
  const ink = rgb('--ink'), card = rgb('--card')
  const edge = radius + 2, size = Math.ceil(edge) * 2 + 2, mid = size / 2
  const data = new Uint8Array(size * size * 4)
  const clamp = (v: number) => Math.max(0, Math.min(1, v))
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - mid, y + 0.5 - mid)
      const inside = clamp(radius - d + 0.5)
      data.set([...ink.map((v, k) => Math.round(v * inside + card[k] * (1 - inside))), Math.round(clamp(edge - d + 0.5) * 255)], (y * size + x) * 4)
    }
  }
  return { width: size, height: size, data }
}
const DOTS: Record<string, number> = { 'city-dot': 4.8, 'capital-dot': 6.4 }

export function Globe({ status, pins, onCountry, routes = [], focus = null }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const moved = useRef(false)
  const aimed = useRef(false)
  const map = useRef<maplibregl.Map | null>(null)
  const placed = useRef<Placed[]>([])
  const glyphs = useRef<maplibregl.Marker[]>([])
  const open = useRef<string | null>(null)
  const touch = useRef(false)
  // the spin holds while someone has hold of the globe, then waits a few seconds ('next' = start waiting next frame)
  const still = useRef<{ held: boolean; until: number | 'next' }>({ held: false, until: 0 })
  const [tip, setTip] = useState<{ code: string; x: number; y: number } | null>(null)
  // totoro stays until the countries are drawn (or the map gives up), then the globe fades in
  const [drawn, setDrawn] = useState(false)
  const tipId = useId()
  const latest = useRef({ status, onCountry, pins })
  latest.current = { status, onCountry, pins }

  // pins hide while zoomed out and fade in with the first country names; pins on the far side
  // of the globe hide too. the open tip follows its pin, or closes with it
  function place() {
    const m = map.current
    if (!m) return
    const near = Math.max(0, Math.min(1, (m.getZoom() - NAMES_FROM) / FADE))
    let at: { x: number; y: number } | null = null
    for (const { pin, marker, el } of placed.current) {
      const hidden = near === 0 || m.transform.isLocationOccluded(marker.getLngLat())
      el.style.visibility = hidden ? 'hidden' : ''
      el.style.opacity = near < 1 ? String(near) : ''
      if (pin.code === open.current && !hidden) {
        at = m.project(marker.getLngLat())
        el.setAttribute('aria-describedby', tipId)
      } else {
        el.removeAttribute('aria-describedby')
      }
    }
    if (!at) open.current = null
    setTip(at && open.current ? { code: open.current, x: at.x, y: at.y } : null)
    // a glyph round the back of the globe hides too
    for (const g of glyphs.current) g.getElement().style.visibility = m.transform.isLocationOccluded(g.getLngLat()) ? 'hidden' : ''
  }

  function show(code: string) { open.current = code; place() }
  function hide() { open.current = null; place() }

  // phones have no hover: the first tap shows the tip, the second opens the country.
  // a pin round the back of the globe is turned to first, so the tap still shows something
  function choose(code: string) {
    const hit = placed.current.find((x) => x.pin.code === code)
    const m = map.current
    if (!touch.current || !hit || open.current === code) { latest.current.onCountry(code); return }
    if (m && m.transform.isLocationOccluded(hit.marker.getLngLat())) {
      m.once('moveend', () => show(code))
      m.easeTo({ center: hit.marker.getLngLat(), duration: reduced() ? 0 : 400 })
      return
    }
    show(code)
  }

  // zoomed out the pins are hidden, so a tap on a coloured country flies in to it first (its pin, or where it was tapped)
  function flyIn(code: string, at: maplibregl.LngLat) {
    const hit = placed.current.find((x) => x.pin.code === code)
    const center: [number, number] = hit ? [hit.pin.lng, hit.pin.lat] : [at.lng, at.lat]
    map.current?.flyTo({ center, zoom: CLOSE, duration: reduced() ? 0 : 1200 })
  }

  useEffect(() => {
    if (!box.current) return
    // names are lettered from files the app carries, so they need no font server and work offline.
    // they sit on their own sources, so lettering that can't load never takes the countries with it
    const style: StyleSpecification = {
      version: 8,
      projection: { type: 'globe' },
      glyphs: globeFile('fonts/{fontstack}/{range}.pbf'),
      sources: {
        countries: { type: 'geojson', data: `${import.meta.env.BASE_URL}countries-110m.geojson` },
        'country-names': { type: 'geojson', data: EMPTY },
        cities: { type: 'geojson', data: EMPTY },
        routes: { type: 'geojson', data: EMPTY },
      },
      layers: [
        { id: 'water', type: 'background', paint: { 'background-color': css('--globe-water') } },
        { id: 'countries-fill', type: 'fill', source: 'countries', paint: { 'fill-color': fillFor(latest.current.status) } },
        { id: 'countries-line', type: 'line', source: 'countries', paint: { 'line-color': css('--ground'), 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.6, 6, 1.2] } },
        { id: 'been-edge', type: 'line', source: 'countries', minzoom: NEAR[0], filter: edgeFor(latest.current.status),
          paint: { 'line-color': css('--been'), 'line-width': ['interpolate', ['linear'], ['zoom'], NEAR[0], 0, NEAR[1], 1.6] } },
        // flights bend over the earth as a dashed arc; trains, buses and ferries run as a solid line
        { id: 'routes-flight', type: 'line', source: 'routes', filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'mode'], 'flight']],
          layout: { 'line-cap': 'round' }, paint: { 'line-color': css('--ink'), 'line-width': 1.8, 'line-dasharray': [1.5, 2] } },
        { id: 'routes-ground', type: 'line', source: 'routes', filter: ['all', ['==', ['geometry-type'], 'LineString'], ['!=', ['get', 'mode'], 'flight']],
          layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': css('--ink'), 'line-width': 2 } },
        { id: 'routes-ends', type: 'circle', source: 'routes', filter: ['==', ['geometry-type'], 'Point'],
          paint: { 'circle-radius': 3.5, 'circle-color': css('--ink'), 'circle-stroke-color': css('--card'), 'circle-stroke-width': 1.5 } },
        ...nameLayers(),
      ],
    }
    let m: maplibregl.Map
    try {
      m = new maplibregl.Map({
        container: box.current, style, center: middleOf(latest.current.pins), zoom: START_ZOOM, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM,
        attributionControl: false, scrollZoom: false, dragRotate: false, pitchWithRotate: false,
        // one finger scrolls the page past the globe; two fingers turn it
        cooperativeGestures: true,
        locale: {
          'CooperativeGesturesHandler.MobileHelpText': 'use two fingers to turn the globe',
          'CooperativeGesturesHandler.WindowsHelpText': 'pinch to zoom',
          'CooperativeGesturesHandler.MacHelpText': 'pinch to zoom',
        },
        renderWorldCopies: false,
      })
    } catch {
      setDrawn(true)
      return // no webgl: the rest of home still works
    }
    map.current = m
    m.once('load', () => setDrawn(true))
    m.on('error', () => setDrawn(true))
    aimed.current = latest.current.pins.length > 0
    m.touchZoomRotate.disableRotation()

    m.on('click', (e) => {
      if ((e.originalEvent?.target as Element | null)?.closest?.('.globe-pin')) return
      const code = m.queryRenderedFeatures(e.point, { layers: ['countries-fill'] })[0]?.properties?.ISO_A2 as string | undefined
      if (!code || !latest.current.status.has(code)) hide()
      else if (m.getZoom() < NAMES_FROM) flyIn(code, e.lngLat)
      else choose(code)
    })
    m.on('mousemove', 'countries-fill', (e) => {
      const code = e.features?.[0]?.properties?.ISO_A2 as string | undefined
      m.getCanvas().style.cursor = code && latest.current.status.has(code) ? 'pointer' : ''
    })
    m.on('mouseleave', 'countries-fill', () => { m.getCanvas().style.cursor = '' })
    m.on('move', place)
    const touched = () => { moved.current = true }
    m.on('dragstart', touched)
    m.on('zoomstart', touched)

    let detailed = false
    m.on('zoom', () => {
      if (detailed || m.getZoom() < DETAIL_FROM) return
      detailed = true
      m.getSource<GeoJSONSource>('countries')?.setData(globeFile('countries-50m.json'))
      m.getSource<GeoJSONSource>('country-names')?.setData(globeFile('country-names.json'))
      m.getSource<GeoJSONSource>('cities')?.setData(globeFile('cities.json'))
    })
    m.on('styleimagemissing', (e: { id: string }) => {
      if (DOTS[e.id] && !m.hasImage(e.id)) m.addImage(e.id, dot(DOTS[e.id]), { pixelRatio: 2 })
    })

    return () => {
      for (const x of placed.current) x.marker.remove()
      placed.current = []
      for (const g of glyphs.current) g.remove()
      glyphs.current = []
      m.remove()
      map.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = map.current
    if (!m) return
    const apply = () => {
      m.setPaintProperty('countries-fill', 'fill-color', fillFor(status))
      m.setFilter('been-edge', edgeFor(status))
    }
    if (m.isStyleLoaded()) apply()
    else m.once('load', apply)
  }, [status])

  // an opened way of getting around draws its journeys (a flight as an arc, the rest straight), puts its glyph
  // on the middle of each distinct route, and the globe turns to take them all in
  const routesKey = JSON.stringify(routes)
  useEffect(() => {
    const m = map.current
    if (!m) return
    const apply = () => {
      for (const g of glyphs.current) g.remove()
      glyphs.current = []
      const features: GeoJSON.Feature[] = []
      const seen = new Set<string>()
      const drawn: LngLat[] = []
      for (const { line: [a, b], mode } of routes) {
        const path = mode === 'flight' ? arc(a, b) : [a, b]
        drawn.push(...path)
        features.push(
          { type: 'Feature', properties: { mode }, geometry: { type: 'LineString', coordinates: path } },
          { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: a } },
          { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: b } },
        )
        // the same route flown twice gets one glyph, so a busy year never crowds the globe
        const mid = path[Math.floor(path.length / 2)]
        const key = `${mode}:${[a, b].map((p) => p.map((v) => v.toFixed(1)).join(',')).sort().join('|')}`
        if (seen.has(key)) continue
        seen.add(key)
        glyphs.current.push(new maplibregl.Marker({ element: glyphElement(mode ?? 'train') }).setLngLat(mid).addTo(m))
      }
      m.getSource<GeoJSONSource>('routes')?.setData({ type: 'FeatureCollection', features })
      place()
      if (!drawn.length) return
      const lngs = drawn.map((p) => p[0]), lats = drawn.map((p) => p[1])
      still.current = { held: false, until: 'next' }
      try {
        m.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 48, maxZoom: CLOSE, duration: reduced() ? 0 : 1200 })
      } catch { /* a view maplibre can't fit: the lines are still drawn */ }
    }
    if (m.isStyleLoaded()) apply()
    else m.once('load', apply)
  }, [routesKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // a tapped stamp turns the globe to its country and shows that country's tip
  useEffect(() => {
    const m = map.current
    if (!m || !focus) return
    const hit = placed.current.find((x) => x.pin.code === focus.code)
    if (!hit) return
    still.current = { held: false, until: 'next' }
    m.once('moveend', () => show(focus.code))
    m.flyTo({ center: [hit.pin.lng, hit.pin.lat], zoom: Math.max(m.getZoom(), CLOSE), duration: reduced() ? 0 : 1400 })
  }, [focus?.n]) // eslint-disable-line react-hooks/exhaustive-deps

  // the slow spin: only zoomed out, never while someone holds it (pins and tips only show once it stops), never with reduced motion
  useEffect(() => {
    if (reduced()) return
    let frame = 0
    let last: number | null = null
    const turn = (t: number) => {
      frame = requestAnimationFrame(turn)
      // a long gap (the app was in the background) moves it no further than one ordinary frame
      const dt = last === null ? 0 : Math.min(t - last, 100)
      last = t
      const m = map.current
      const s = still.current
      if (!m || s.held || m.getZoom() >= NAMES_FROM || m.isMoving()) return
      if (s.until === 'next') s.until = t + RESUME_MS
      if (t < s.until) return
      const c = m.getCenter()
      m.setCenter([c.lng - (SPIN * dt) / 1000, c.lat])
    }
    frame = requestAnimationFrame(turn)
    const letGo = () => {
      if (!still.current.held) return
      still.current = { held: false, until: 'next' }
    }
    window.addEventListener('pointerup', letGo)
    window.addEventListener('pointercancel', letGo)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointerup', letGo)
      window.removeEventListener('pointercancel', letGo)
    }
  }, [])

  // pins are real buttons: focusable, and they need no map font. they're kept by country,
  // so a realtime redraw doesn't take keyboard focus away
  useEffect(() => {
    const m = map.current
    if (!m) return
    const have = new Map(placed.current.map((x) => [x.pin.code, x]))
    const codes = new Set(pins.map((p) => p.code))
    for (const x of placed.current) if (!codes.has(x.pin.code)) x.marker.remove()
    placed.current = pins.map((pin) => {
      const old = have.get(pin.code)
      if (old) {
        old.pin = pin
        old.el.dataset.status = pin.status
        old.el.setAttribute('aria-label', pin.name)
        old.marker.setLngLat([pin.lng, pin.lat])
        return old
      }
      const el = document.createElement('button')
      el.type = 'button'
      el.className = 'globe-pin'
      el.dataset.status = pin.status
      el.innerHTML = PIN
      el.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') show(pin.code) })
      el.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') hide() })
      el.addEventListener('focus', () => show(pin.code))
      el.addEventListener('blur', hide)
      el.addEventListener('click', () => choose(pin.code))
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([pin.lng, pin.lat]).addTo(m)
      el.setAttribute('aria-label', pin.name) // after addTo, which labels every marker "map marker"
      return { pin, marker, el }
    })
    // places that arrive after the globe opened still get centred on, unless someone already turned it
    if (!aimed.current && !moved.current && pins.length) {
      aimed.current = true
      m.jumpTo({ center: middleOf(pins) })
    }
    place()
  }, [pins]) // eslint-disable-line react-hooks/exhaustive-deps

  // pinches zoom the globe, never the page; a plain scroll still scrolls the page.
  // safari on a mac sends a trackpad pinch as its own gesture events (scale since the pinch began);
  // phones send those too, but maplibre already zooms from the touches there
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const trackpad = 'GestureEvent' in window && !navigator.maxTouchPoints
    let from: number | null = null
    const zoom = (z: number) => map.current?.zoomTo(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z)), { duration: 0 })
    // a pinch pauses the spin like a drag does
    const pause = () => { still.current.until = 'next' }
    const wheel = (e: WheelEvent) => {
      const m = map.current
      if (!e.ctrlKey || !m) return
      e.preventDefault()
      pause()
      if (from === null) zoom(m.getZoom() - e.deltaY / 100)
    }
    const start = (e: Event) => { e.preventDefault(); pause(); from = map.current?.getZoom() ?? null }
    const change = (e: Event) => {
      e.preventDefault()
      pause()
      const scale = (e as Event & { scale?: number }).scale
      if (trackpad && from !== null && scale) zoom(from + Math.log2(scale))
    }
    const end = (e: Event) => { e.preventDefault(); from = null }
    const opts = { passive: false }
    el.addEventListener('wheel', wheel, opts)
    el.addEventListener('gesturestart', start, opts)
    el.addEventListener('gesturechange', change, opts)
    el.addEventListener('gestureend', end, opts)
    return () => {
      el.removeEventListener('wheel', wheel)
      el.removeEventListener('gesturestart', start)
      el.removeEventListener('gesturechange', change)
      el.removeEventListener('gestureend', end)
    }
  }, [])

  // an open tip closes on escape or a tap anywhere off the globe
  const tipCode = tip?.code ?? null
  useEffect(() => {
    if (!tipCode) return
    const off = openLayer(() => hide())
    const away = (e: Event) => { if (!wrap.current?.contains(e.target as Node)) hide() }
    document.addEventListener('pointerdown', away)
    return () => { off(); document.removeEventListener('pointerdown', away) }
  }, [tipCode]) // eslint-disable-line react-hooks/exhaustive-deps

  const pin = tip ? pins.find((p) => p.code === tip.code) : undefined
  return (
    <div ref={wrap} className={`globe-wrap${drawn ? ' drawn' : ''}`} onPointerDownCapture={(e) => { touch.current = e.pointerType === 'touch'; still.current.held = true }}>
      <div ref={box} className="globe" role="region" aria-label="globe" />
      {!drawn && <Loading label="loading globe" size="small" className="globe-loading" />}
      {tip && pin && <GlobeTip id={tipId} pin={pin} x={tip.x} y={tip.y} width={box.current?.clientWidth ?? 0} />}
    </div>
  )
}
