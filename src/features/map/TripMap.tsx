import { useEffect, useRef, useState } from 'react'
import { Pending } from '../../components/Pending'
import maplibregl, { type GeoJSONSource, type LngLatBoundsLike, type StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { FeatureCollection } from 'geojson'
import type { Place } from '../../lib/types'
import type { MapData } from './features'
import type { Overview } from './overview'
import { iconPath } from '../../components/Icon'

export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron'

// used when the street map can't load (offline, or the tile host is down): country shapes only
function plainStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: { countries: { type: 'geojson', data: `${import.meta.env.BASE_URL}countries-110m.geojson` } },
    layers: [
      { id: 'water', type: 'background', paint: { 'background-color': css('var(--map-water)') } },
      { id: 'land', type: 'fill', source: 'countries', paint: { 'fill-color': css('var(--map-land)') } },
      { id: 'borders', type: 'line', source: 'countries', paint: { 'line-color': css('var(--line)'), 'line-width': 0.8 } },
    ],
  }
}

type Props = {
  data: MapData
  fitKey: string
  fallback: Place | null
  focus: Place | null
  // the stop lit in the plan beside the map
  highlight?: string | null
  // how much of the top and bottom other things cover (the phone's floating bar, chips and places sheet)
  inset?: { top: number; bottom: number }
  onPick: (id: string) => void
  onEmpty: (p: { lng: number; lat: number }) => void
  onCenter?: (p: { lng: number; lat: number; zoom: number }) => void
  // the whole trip: home and one pin per side trip, drawn as html markers
  overview?: Overview | null
  onTrip?: (id: string) => void
}

const root = () => getComputedStyle(document.documentElement)
const css = (v: string) => {
  const m = v.match(/var\((--[\w-]+)\)/)
  return m ? root().getPropertyValue(m[1]).trim() : v
}

// maplibre paints with real colours, not css variables
function paint<T extends FeatureCollection>(c: T): T {
  return { ...c, features: c.features.map((f) => (f.properties?.color ? { ...f, properties: { ...f.properties, color: css(f.properties.color) } } : f)) }
}

function bookmark(color: string, card: string): ImageData {
  const s = 2, w = 22 * s, h = 26 * s
  const cv = document.createElement('canvas')
  cv.width = w; cv.height = h
  const g = cv.getContext('2d')!
  g.fillStyle = card
  g.beginPath(); g.roundRect(1 * s, 1 * s, 20 * s, 24 * s, 5 * s); g.fill()
  g.fillStyle = color
  g.beginPath(); g.moveTo(6 * s, 5 * s); g.lineTo(16 * s, 5 * s); g.lineTo(16 * s, 21 * s); g.lineTo(11 * s, 17 * s); g.lineTo(6 * s, 21 * s); g.closePath(); g.fill()
  return g.getImageData(0, 0, w, h)
}

// a small bed on an ink square: where tonight is slept
function bedPin(color: string, card: string): ImageData {
  const s = 2, w = 22 * s, h = 22 * s
  const cv = document.createElement('canvas')
  cv.width = w; cv.height = h
  const g = cv.getContext('2d')!
  g.fillStyle = color
  g.beginPath(); g.roundRect(1 * s, 1 * s, 20 * s, 20 * s, 5 * s); g.fill()
  g.fillStyle = card
  g.fillRect(5 * s, 6 * s, 2 * s, 10 * s)
  g.fillRect(5 * s, 12 * s, 12 * s, 2 * s)
  g.fillRect(7 * s, 8 * s, 4 * s, 3 * s)
  g.fillRect(12 * s, 9 * s, 5 * s, 3 * s)
  return g.getImageData(0, 0, w, h)
}

function boundsOf(d: MapData, o?: Overview | null): LngLatBoundsLike | null {
  const pts: number[][] = []
  if (o?.home) pts.push(o.home.at)
  for (const s of o?.sides ?? []) if (s.at) pts.push(s.at)
  for (const f of d.pins.features) pts.push(f.geometry.coordinates)
  for (const f of d.ends.features) pts.push(f.geometry.coordinates)
  for (const f of d.beds.features) pts.push(f.geometry.coordinates)
  for (const f of d.lines.features) pts.push(...f.geometry.coordinates)
  // ideas only fit the view when nothing else is on it
  if (!pts.length) for (const f of d.saved.features) pts.push(f.geometry.coordinates)
  if (!pts.length) return null
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1])
  return [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]]
}

export function TripMap({ data, fitKey, fallback, focus, highlight, inset, onPick, onEmpty, onCenter, overview, onTrip }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const ready = useRef(false)
  const [drawn, setDrawn] = useState(false)
  const fitted = useRef<string | null>(null)
  const cb = useRef({ onPick, onEmpty, onCenter, onTrip })
  cb.current = { onPick, onEmpty, onCenter, onTrip }
  const latest = useRef({ data, fallback, inset, overview })
  latest.current = { data, fallback, inset, overview }
  const fitKeyRef = useRef(fitKey)
  fitKeyRef.current = fitKey

  useEffect(() => {
    if (!box.current) return
    let m: maplibregl.Map
    try {
      m = new maplibregl.Map({ container: box.current, style: MAP_STYLE, center: [10, 50], zoom: 3.5, attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false })
    } catch {
      return
    }
    map.current = m
    m.touchZoomRotate.disableRotation()
    let plain = false
    m.on('error', () => {
      if (!ready.current && !plain && !m.isStyleLoaded()) { plain = true; m.setStyle(plainStyle()) }
    })
    m.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false }), 'bottom-right')

    m.on('load', () => {
      const ink = css('var(--ink)'), ink2 = css('var(--ink-2)'), card = css('var(--card)')
      m.addImage('bookmark', bookmark(ink, card), { pixelRatio: 2 })
      m.addImage('bed', bedPin(ink, card), { pixelRatio: 2 })
      const empty = { type: 'FeatureCollection', features: [] } as FeatureCollection
      for (const id of ['lines', 'pins', 'pin-labels', 'ends', 'beds', 'pin-names', 'saved', 'focus']) m.addSource(id, { type: 'geojson', data: empty })
      m.addLayer({ id: 'day-lines', type: 'line', source: 'lines', filter: ['==', ['get', 'kind'], 'day'], paint: { 'line-color': ['get', 'color'], 'line-width': 2.5, 'line-dasharray': [1.2, 1.6], 'line-opacity': 0.8 }, layout: { 'line-cap': 'round' } })
      m.addLayer({ id: 'spokes', type: 'line', source: 'lines', filter: ['==', ['get', 'kind'], 'spoke'], paint: { 'line-color': ['get', 'color'], 'line-width': 1.5, 'line-dasharray': [2, 2] } })
      m.addLayer({ id: 'journeys', type: 'line', source: 'lines', filter: ['all', ['==', ['get', 'kind'], 'journey'], ['!=', ['get', 'mode'], 'flight']], paint: { 'line-color': ink2, 'line-width': 2.5 } })
      m.addLayer({ id: 'flights', type: 'line', source: 'lines', filter: ['all', ['==', ['get', 'kind'], 'journey'], ['==', ['get', 'mode'], 'flight']], paint: { 'line-color': ink2, 'line-width': 2, 'line-dasharray': [2, 2] } })
      m.addLayer({ id: 'saved', type: 'symbol', source: 'saved', layout: { 'icon-image': 'bookmark', 'icon-allow-overlap': true, 'icon-anchor': 'bottom' } })
      // the stop lit in the plan beside: a soft ring in its colour
      m.addLayer({ id: 'halo', type: 'circle', source: 'pins', filter: ['==', ['get', 'id'], ''], paint: { 'circle-radius': 20, 'circle-color': ['get', 'color'], 'circle-opacity': 0.25 } })
      m.addLayer({ id: 'journey-ends', type: 'circle', source: 'ends', paint: { 'circle-radius': 6, 'circle-color': ['get', 'color'], 'circle-stroke-color': card, 'circle-stroke-width': 2 } })
      m.addLayer({ id: 'beds', type: 'symbol', source: 'beds', layout: { 'icon-image': 'bed', 'icon-allow-overlap': true } })
      // names sit on their own source too: a missing font only loses the names
      m.addLayer({ id: 'pin-names', type: 'symbol', source: 'pin-names', layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-offset': [0, 1.4], 'text-anchor': 'top', 'text-optional': true }, paint: { 'text-color': ink, 'text-halo-color': card, 'text-halo-width': 1.5 } })
      m.addLayer({ id: 'pins', type: 'circle', source: 'pins', paint: { 'circle-radius': 12, 'circle-color': ['get', 'color'], 'circle-stroke-color': card, 'circle-stroke-width': 2 } })
      // numbers sit on their own source: if the font can't load, the pins still show
      m.addLayer({ id: 'pin-numbers', type: 'symbol', source: 'pin-labels', layout: { 'text-field': ['to-string', ['get', 'number']], 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-allow-overlap': true }, paint: { 'text-color': card } })
      m.addLayer({ id: 'focus', type: 'circle', source: 'focus', paint: { 'circle-radius': 9, 'circle-color': ink, 'circle-stroke-color': card, 'circle-stroke-width': 3 } })
      ready.current = true
      setDrawn(true)
      push()
    })

    m.on('click', (e) => {
      const hit = m.queryRenderedFeatures(e.point, { layers: ['pins', 'saved', 'beds', 'journey-ends'].filter((l) => m.getLayer(l)) })[0]
      const id = hit?.properties?.id as string | undefined
      if (id) cb.current.onPick(id)
      else cb.current.onEmpty({ lng: e.lngLat.lng, lat: e.lngLat.lat })
    })
    for (const l of ['pins', 'saved', 'beds', 'journey-ends']) {
      m.on('mouseenter', l, () => { m.getCanvas().style.cursor = 'pointer' })
      m.on('mouseleave', l, () => { m.getCanvas().style.cursor = '' })
    }
    const report = () => { const c = m.getCenter(); cb.current.onCenter?.({ lng: c.lng, lat: c.lat, zoom: m.getZoom() }) }
    m.on('moveend', report)
    // and once it first draws, before anyone has moved it
    m.on('load', report)

    return () => { ready.current = false; m.remove(); map.current = null }
  }, [])

  function push() {
    const m = map.current
    if (!m || !ready.current) return
    const { data: d, fallback: fb, inset: cover, overview: ov } = latest.current
    ;(m.getSource('pins') as GeoJSONSource).setData(paint(d.pins))
    ;(m.getSource('pin-labels') as GeoJSONSource).setData(d.pins)
    ;(m.getSource('lines') as GeoJSONSource).setData(paint(d.lines))
    ;(m.getSource('ends') as GeoJSONSource).setData(paint(d.ends))
    ;(m.getSource('beds') as GeoJSONSource).setData(d.beds)
    ;(m.getSource('pin-names') as GeoJSONSource).setData(paint(d.names))
    ;(m.getSource('saved') as GeoJSONSource).setData(d.saved)
    if (fitted.current !== fitKeyRef.current) {
      fitted.current = fitKeyRef.current
      const b = boundsOf(d, ov)
      if (b) m.fitBounds(b, { padding: { top: cover?.top ?? 150, bottom: cover?.bottom ?? 90, left: 40, right: 40 }, maxZoom: 14, duration: 0 })
      else if (fb && fb.lat != null && fb.lng != null) m.jumpTo({ center: [fb.lng, fb.lat], zoom: 11 })
      else m.jumpTo({ center: [10, 50], zoom: 3.5 })
    }
  }
  useEffect(push, [data, fitKey, overview]) // eslint-disable-line react-hooks/exhaustive-deps

  // the overview's pins are html, so they live outside the geojson sources
  useEffect(() => {
    const m = map.current
    if (!m || !drawn || !overview) return
    const made: maplibregl.Marker[] = []
    const add = (el: HTMLElement, at: [number, number]) => {
      const mk = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(at).addTo(m)
      made.push(mk)
    }
    if (overview.home) {
      const el = document.createElement('div')
      el.className = 'side-pin home'
      el.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path></path></svg><span class="side-name"></span>'
      el.querySelector('path')!.setAttribute('d', iconPath('bed'))
      el.querySelector('.side-name')!.textContent = overview.home.name
      add(el, overview.home.at)
    }
    for (const s of overview.sides) {
      if (!s.at) continue
      const el = document.createElement('button')
      el.type = 'button'
      el.className = 'side-pin'
      const dot = document.createElement('span')
      dot.className = 'side-dot'
      dot.style.background = s.color
      const text = document.createElement('span')
      text.className = 'side-text'
      const name = document.createElement('span')
      name.className = 'side-name'
      name.textContent = s.name
      text.append(name)
      if (s.dates) {
        const dates = document.createElement('span')
        dates.className = 'side-dates'
        dates.textContent = s.dates
        text.append(dates)
      }
      el.append(dot, text)
      el.addEventListener('click', () => cb.current.onTrip?.(s.id))
      add(el, s.at)
      el.setAttribute('aria-label', `${s.name}${s.dates ? `, ${s.dates}` : ''}`) // after addTo, which labels every marker "map marker"
    }
    return () => { for (const mk of made) mk.remove() }
  }, [overview, drawn])

  useEffect(() => {
    const m = map.current
    if (!m || !ready.current) return
    const src = m.getSource('focus') as GeoJSONSource | undefined
    src?.setData({ type: 'FeatureCollection', features: focus && focus.lat != null && focus.lng != null ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [focus.lng, focus.lat] } }] : [] })
    if (focus && focus.lat != null && focus.lng != null) m.easeTo({ center: [focus.lng, focus.lat], zoom: Math.max(m.getZoom(), 13), duration: 500 })
  }, [focus])

  useEffect(() => {
    const m = map.current
    if (!m || !ready.current || !m.getLayer('halo')) return
    m.setFilter('halo', ['==', ['get', 'id'], highlight ?? ''])
  }, [highlight])

  return <>
    <div ref={box} className="trip-map-canvas" />
    {!drawn && <Pending label="loading map" className="map-loading" />}
  </>
}
