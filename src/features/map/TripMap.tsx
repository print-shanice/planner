import { useEffect, useRef } from 'react'
import maplibregl, { type GeoJSONSource, type LngLatBoundsLike, type StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { FeatureCollection } from 'geojson'
import type { Place } from '../../lib/types'
import type { mapFeatures } from './features'

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

type Data = ReturnType<typeof mapFeatures>
type Props = {
  data: Data
  fitKey: string
  fallback: Place | null
  focus: Place | null
  // the stop lit in the plan beside the map
  highlight?: string | null
  onPick: (id: string) => void
  onEmpty: (p: { lng: number; lat: number }) => void
  onCenter?: (p: { lng: number; lat: number }) => void
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

function boundsOf(d: Data): LngLatBoundsLike | null {
  const pts: number[][] = []
  for (const f of d.pins.features) pts.push(f.geometry.coordinates)
  for (const f of d.saved.features) pts.push(f.geometry.coordinates)
  for (const f of d.lines.features) pts.push(...f.geometry.coordinates)
  if (!pts.length) return null
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1])
  return [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]]
}

export function TripMap({ data, fitKey, fallback, focus, highlight, onPick, onEmpty, onCenter }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const ready = useRef(false)
  const fitted = useRef<string | null>(null)
  const cb = useRef({ onPick, onEmpty, onCenter })
  cb.current = { onPick, onEmpty, onCenter }
  const latest = useRef({ data, fallback })
  latest.current = { data, fallback }
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
      const empty = { type: 'FeatureCollection', features: [] } as FeatureCollection
      for (const id of ['lines', 'pins', 'pin-labels', 'saved', 'focus']) m.addSource(id, { type: 'geojson', data: empty })
      m.addLayer({ id: 'day-lines', type: 'line', source: 'lines', filter: ['==', ['get', 'kind'], 'day'], paint: { 'line-color': ['get', 'color'], 'line-width': 2.5, 'line-dasharray': [1.2, 1.6], 'line-opacity': 0.8 }, layout: { 'line-cap': 'round' } })
      m.addLayer({ id: 'journeys', type: 'line', source: 'lines', filter: ['all', ['==', ['get', 'kind'], 'journey'], ['!=', ['get', 'mode'], 'flight']], paint: { 'line-color': ink2, 'line-width': 2.5 } })
      m.addLayer({ id: 'flights', type: 'line', source: 'lines', filter: ['all', ['==', ['get', 'kind'], 'journey'], ['==', ['get', 'mode'], 'flight']], paint: { 'line-color': ink2, 'line-width': 2, 'line-dasharray': [2, 2] } })
      m.addLayer({ id: 'saved', type: 'symbol', source: 'saved', layout: { 'icon-image': 'bookmark', 'icon-allow-overlap': true, 'icon-anchor': 'bottom' } })
      // the stop lit in the plan beside: a soft ring in its colour
      m.addLayer({ id: 'halo', type: 'circle', source: 'pins', filter: ['==', ['get', 'id'], ''], paint: { 'circle-radius': 20, 'circle-color': ['get', 'color'], 'circle-opacity': 0.25 } })
      m.addLayer({ id: 'pins', type: 'circle', source: 'pins', paint: { 'circle-radius': 12, 'circle-color': ['get', 'color'], 'circle-stroke-color': card, 'circle-stroke-width': 2 } })
      // numbers sit on their own source: if the font can't load, the pins still show
      m.addLayer({ id: 'pin-numbers', type: 'symbol', source: 'pin-labels', layout: { 'text-field': ['to-string', ['get', 'number']], 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-allow-overlap': true }, paint: { 'text-color': card } })
      m.addLayer({ id: 'focus', type: 'circle', source: 'focus', paint: { 'circle-radius': 9, 'circle-color': ink, 'circle-stroke-color': card, 'circle-stroke-width': 3 } })
      ready.current = true
      push()
    })

    m.on('click', (e) => {
      const hit = m.queryRenderedFeatures(e.point, { layers: ['pins', 'saved'].filter((l) => m.getLayer(l)) })[0]
      const id = hit?.properties?.id as string | undefined
      if (id) cb.current.onPick(id)
      else cb.current.onEmpty({ lng: e.lngLat.lng, lat: e.lngLat.lat })
    })
    for (const l of ['pins', 'saved']) {
      m.on('mouseenter', l, () => { m.getCanvas().style.cursor = 'pointer' })
      m.on('mouseleave', l, () => { m.getCanvas().style.cursor = '' })
    }
    m.on('moveend', () => { const c = m.getCenter(); cb.current.onCenter?.({ lng: c.lng, lat: c.lat }) })

    return () => { ready.current = false; m.remove(); map.current = null }
  }, [])

  function push() {
    const m = map.current
    if (!m || !ready.current) return
    const { data: d, fallback: fb } = latest.current
    ;(m.getSource('pins') as GeoJSONSource).setData(paint(d.pins))
    ;(m.getSource('pin-labels') as GeoJSONSource).setData(d.pins)
    ;(m.getSource('lines') as GeoJSONSource).setData(paint(d.lines))
    ;(m.getSource('saved') as GeoJSONSource).setData(d.saved)
    if (fitted.current !== fitKeyRef.current) {
      fitted.current = fitKeyRef.current
      const b = boundsOf(d)
      if (b) m.fitBounds(b, { padding: { top: 150, bottom: 90, left: 40, right: 40 }, maxZoom: 14, duration: 0 })
      else if (fb && fb.lat != null && fb.lng != null) m.jumpTo({ center: [fb.lng, fb.lat], zoom: 11 })
      else m.jumpTo({ center: [10, 50], zoom: 3.5 })
    }
  }
  useEffect(push, [data, fitKey]) // eslint-disable-line react-hooks/exhaustive-deps

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

  return <div ref={box} className="trip-map-canvas" />
}
