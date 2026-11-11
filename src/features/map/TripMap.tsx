import { useEffect, useRef, useState } from 'react'
import { Loading } from '../../components/Loading'
import type { Place } from '../../lib/types'
import type { MapData } from './features'
import type { Overview } from './overview'
import { iconPath } from '../../components/Icon'
import { googleMapId } from '../../lib/google/config'
import { lib, loadGoogle, useGoogleState } from '../../lib/google/loader'
import { useOnline } from '../../lib/offline'
import { MapNote } from './MapNote'

export type WalkLine = { path: { lat: number; lng: number }[]; color: string }

type Props = {
  data: MapData
  fitKey: string
  fallback: Place | null
  focus: Place | null
  // the stop lit in the plan beside the map
  highlight?: string | null
  // how much of the top and bottom other things cover (the phone's floating bar and places list)
  inset?: { top: number; bottom: number }
  onPick: (id: string) => void
  onEmpty: (p: { lng: number; lat: number }) => void
  // a tap on one of google's own place labels
  onPoi?: (placeId: string, p: { lng: number; lat: number }) => void
  onCenter?: (p: { lng: number; lat: number; zoom: number }) => void
  overview?: Overview | null
  onTrip?: (id: string) => void
  // the day's walks, along the streets
  walks?: WalkLine[]
  // the stop picked in the list or on the map: it lights up and comes into view
  selected?: string | null
}

type G = typeof google.maps
type MarkerLib = { AdvancedMarkerElement: typeof google.maps.marker.AdvancedMarkerElement }

// one google map per visit: its box moves between screens instead of a new map (and a new paid load) each time
let shared: { map: google.maps.Map; box: HTMLDivElement } | null = null

const root = () => getComputedStyle(document.documentElement)
export const css = (v: string) => {
  const m = v.match(/var\((--[\w-]+)\)/)
  return m ? root().getPropertyValue(m[1]).trim() || v : v
}

function svg(name: string, size = 16): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${iconPath(name)}"></path></svg>`
}

// a stop: its number in a tag edged in its trip's colour; ideas, beds and arrivals keep their marks
export function pinElement(o: { icon: string; color?: string; number?: number | null; kind: 'stop' | 'idea' | 'bed' | 'end'; label: string }): HTMLElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = `gpin gpin-${o.kind}`
  el.setAttribute('aria-label', o.label)
  if (o.color) el.style.setProperty('--pin', css(o.color))
  // a numbered stop shows its number, "01", as the plan does; everything else its icon
  if (o.number != null) {
    const n = document.createElement('span')
    n.className = 'gpin-n'
    n.textContent = String(o.number).padStart(2, '0')
    el.append(n)
  } else if (o.kind !== 'end') el.innerHTML = svg(o.icon, o.kind === 'idea' ? 14 : 16)
  return el
}

function sidePin(name: string, dates: string, color: string | null, home: boolean): HTMLElement {
  const el = document.createElement(home ? 'div' : 'button')
  if (!home) (el as HTMLButtonElement).type = 'button'
  el.className = `side-pin${home ? ' home' : ''}`
  if (home) el.innerHTML = svg('bed')
  else {
    const dot = document.createElement('span')
    dot.className = 'side-dot'
    dot.style.background = css(color ?? 'var(--ink)')
    el.append(dot)
  }
  const text = document.createElement('span')
  text.className = 'side-text'
  const n = document.createElement('span')
  n.className = 'side-name'
  n.textContent = name
  text.append(n)
  if (dates) { const d = document.createElement('span'); d.className = 'side-dates'; d.textContent = dates; text.append(d) }
  el.append(text)
  el.setAttribute('aria-label', `${name}${dates ? `, ${dates}` : ''}`)
  return el
}

type Want = { key: string; at: [number, number]; make: () => HTMLElement; z: number; pick?: () => void; id?: string }

function boundsOf(d: MapData, o?: Overview | null, walks?: WalkLine[]): [number, number][] {
  const pts: [number, number][] = []
  if (o?.home) pts.push(o.home.at)
  for (const s of o?.sides ?? []) if (s.at) pts.push(s.at)
  for (const f of d.pins.features) pts.push(f.geometry.coordinates as [number, number])
  for (const f of d.ends.features) pts.push(f.geometry.coordinates as [number, number])
  for (const f of d.beds.features) pts.push(f.geometry.coordinates as [number, number])
  for (const w of walks ?? []) for (const p of w.path) pts.push([p.lng, p.lat])
  // ideas only fit the view when nothing else is on it
  if (!pts.length) for (const f of d.saved.features) pts.push(f.geometry.coordinates as [number, number])
  return pts
}

export function TripMap(props: Props) {
  const { data, fitKey, fallback, focus, highlight, inset, overview, walks } = props
  const state = useGoogleState()
  const online = useOnline()
  const holder = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [tries, setTries] = useState(0)
  const cb = useRef(props)
  cb.current = props
  const markers = useRef(new Map<string, { m: google.maps.marker.AdvancedMarkerElement; el: HTMLElement; sig: string }>())
  const lines = useRef<google.maps.Polyline[]>([])
  const fitted = useRef<string | null>(null)
  const markerLib = useRef<MarkerLib | null>(null)

  // load google only when this map shows, then borrow the visit's one map
  useEffect(() => {
    if (!online) return
    let alive = true
    ;(async () => {
      try {
        await loadGoogle()
        const [{ Map }, mk] = await Promise.all([lib<{ Map: G['Map'] }>('maps'), lib<MarkerLib>('marker')])
        if (!alive || !holder.current) return
        markerLib.current = mk
        if (!shared) {
          const box = document.createElement('div')
          box.className = 'gmap'
          const map = new Map(box, {
            mapId: googleMapId(), center: { lat: 50, lng: 10 }, zoom: 4, disableDefaultUI: true, zoomControl: true,
            clickableIcons: true, gestureHandling: 'greedy', fullscreenControl: false, cameraControl: false,
          } as google.maps.MapOptions)
          shared = { map, box }
        }
        holder.current.append(shared.box)
        fitted.current = null
        setMap(shared.map)
      } catch { /* the note below says the map couldn't load */ }
    })()
    return () => {
      alive = false
      // the map stays alive for the next screen; only its markers and lines go
      for (const { m } of markers.current.values()) m.map = null
      markers.current.clear()
      for (const l of lines.current) l.setMap(null)
      lines.current = []
      shared?.box.remove()
      setMap(null)
    }
  }, [online, tries])

  // taps: a stop's marker picks it; google's own labels become a place; anywhere else is a dropped pin
  useEffect(() => {
    if (!map) return
    const click = map.addListener('click', (e: google.maps.MapMouseEvent & { placeId?: string; stop?: () => void }) => {
      const at = e.latLng ? { lat: e.latLng.lat(), lng: e.latLng.lng() } : null
      if (e.placeId && cb.current.onPoi && at) { e.stop?.(); cb.current.onPoi(e.placeId, at); return }
      if (at) cb.current.onEmpty(at)
    })
    const idle = map.addListener('idle', () => {
      const c = map.getCenter()
      if (c) cb.current.onCenter?.({ lat: c.lat(), lng: c.lng(), zoom: map.getZoom() ?? 4 })
    })
    return () => { click.remove(); idle.remove() }
  }, [map])

  // markers: kept by key and only rebuilt when what they show changes
  useEffect(() => {
    const mk = markerLib.current
    if (!map || !mk) return
    const want: Want[] = []
    for (const f of data.saved.features) {
      const p = f.properties
      want.push({ key: `idea:${p.id}`, id: p.id, at: f.geometry.coordinates as [number, number], z: 1, make: () => pinElement({ kind: 'idea', icon: p.icon, label: 'idea' }), pick: () => cb.current.onPick(p.id) })
    }
    for (const f of data.ends.features) {
      const p = f.properties
      want.push({ key: `end:${p.id}`, id: p.id, at: f.geometry.coordinates as [number, number], z: 2, make: () => pinElement({ kind: 'end', icon: '', color: p.color, label: 'arrival' }), pick: () => cb.current.onPick(p.id) })
    }
    for (const f of data.beds.features) {
      const p = f.properties
      want.push({ key: `bed:${p.id}`, id: p.id, at: f.geometry.coordinates as [number, number], z: 3, make: () => pinElement({ kind: 'bed', icon: 'bed', label: 'tonight\'s bed' }), pick: () => cb.current.onPick(p.id) })
    }
    const names = new Map(data.names.features.map((f) => [(f.geometry.coordinates as number[]).join(','), f.properties.name]))
    for (const f of data.pins.features) {
      const p = f.properties
      const name = names.get((f.geometry.coordinates as number[]).join(',')) ?? ''
      want.push({ key: `pin:${p.id}:${p.number}:${p.color}:${p.icon}`, id: p.id, at: f.geometry.coordinates as [number, number], z: 10 + p.number, make: () => pinElement({ kind: 'stop', icon: p.icon, color: p.color, number: p.number, label: `${p.number} ${name}`.trim() }), pick: () => cb.current.onPick(p.id) })
    }
    if (overview?.home) want.push({ key: `home:${overview.home.name}`, at: overview.home.at, z: 5, make: () => sidePin(overview.home!.name, '', null, true) })
    for (const s of overview?.sides ?? []) {
      if (s.at) want.push({ key: `side:${s.id}:${s.name}:${s.dates}:${s.color}`, at: s.at, z: 6, make: () => sidePin(s.name, s.dates, s.color, false), pick: () => cb.current.onTrip?.(s.id) })
    }
    const keep = new Set(want.map((w) => w.key))
    for (const [k, v] of markers.current) if (!keep.has(k)) { v.m.map = null; markers.current.delete(k) }
    for (const w of want) {
      const sig = `${w.at[0]},${w.at[1]}`
      const had = markers.current.get(w.key)
      if (had) { if (had.sig !== sig) { had.m.position = { lng: w.at[0], lat: w.at[1] }; had.sig = sig } continue }
      const el = w.make()
      if (w.id) el.dataset.stop = w.id
      // the marker's own button handles the tap, so it isn't also a tap on the map
      el.addEventListener('click', (e) => { e.stopPropagation(); w.pick?.() })
      const m = new mk.AdvancedMarkerElement({ map, position: { lng: w.at[0], lat: w.at[1] }, content: el, zIndex: w.z })
      markers.current.set(w.key, { m, el, sig })
    }
  }, [map, data, overview])

  // lines: journeys straight (dashed for flights), walks along the streets, spokes to side trips
  useEffect(() => {
    if (!map) return
    for (const l of lines.current) l.setMap(null)
    lines.current = []
    const add = (o: google.maps.PolylineOptions) => lines.current.push(new google.maps.Polyline({ map, clickable: false, ...o }))
    const dash = (color: string, weight: number) => [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: color, scale: weight }, offset: '0', repeat: `${weight * 4}px` }]
    const ll = (c: number[]) => ({ lng: c[0], lat: c[1] })
    const walked = new Set((walks ?? []).filter((w) => w.path.length > 1).map((w) => w.color))
    for (const w of walks ?? []) if (w.path.length > 1) add({ path: w.path, strokeColor: css(w.color), strokeOpacity: 0.85, strokeWeight: 4 })
    for (const f of data.lines.features) {
      const p = f.properties
      const path = f.geometry.coordinates.map(ll)
      if (p.kind === 'journey') add(p.mode === 'flight' ? { path, strokeOpacity: 0, icons: dash(css('var(--ink-2)'), 2), geodesic: true } : { path, strokeColor: css('var(--ink-2)'), strokeWeight: 3 })
      // a day's straight dashed line only stands in until (or where) google has no walk for it
      else if (p.kind === 'day' && !walked.has(p.color)) add({ path, strokeOpacity: 0, icons: dash(css(p.color), 2.5) })
      else if (p.kind === 'spoke') add({ path, strokeOpacity: 0, icons: dash(css('var(--ink-3)'), 1.5) })
    }
  }, [map, data, walks])

  // a new view (another day, the whole trip) fits what it shows, clear of whatever covers the edges
  useEffect(() => {
    if (!map || fitted.current === fitKey) return
    fitted.current = fitKey
    const pts = boundsOf(data, overview, walks)
    const pad = { top: inset?.top ?? 60, bottom: inset?.bottom ?? 60, left: 40, right: 40 }
    if (pts.length > 1) {
      const b = new google.maps.LatLngBounds()
      for (const [lng, lat] of pts) b.extend({ lat, lng })
      map.fitBounds(b, pad)
    } else if (pts.length === 1) { map.setCenter({ lng: pts[0][0], lat: pts[0][1] }); map.setZoom(15) }
    else if (fallback?.lat != null && fallback.lng != null) { map.setCenter({ lat: fallback.lat, lng: fallback.lng }); map.setZoom(12) }
    else { map.setCenter({ lat: 50, lng: 10 }); map.setZoom(4) }
  }, [map, fitKey, data, overview]) // eslint-disable-line react-hooks/exhaustive-deps

  // the stop lit in the plan
  useEffect(() => {
    for (const { el } of markers.current.values()) el.classList.toggle('lit', !!el.dataset.stop && (el.dataset.stop === highlight || el.dataset.stop === props.selected))
  }, [highlight, props.selected, map, data])

  // a picked stop comes into view if it's off the edge
  useEffect(() => {
    if (!map || !props.selected) return
    const hit = [...markers.current.values()].find((v) => v.el.dataset.stop === props.selected)
    const pos = hit?.m.position as google.maps.LatLngLiteral | undefined
    if (pos && !map.getBounds()?.contains(pos)) map.panTo(pos)
  }, [props.selected, map])

  // a searched or tapped place: a ring, and the map goes to it
  useEffect(() => {
    if (!map || !markerLib.current) return
    if (!focus || focus.lat == null || focus.lng == null) return
    const el = pinElement({ kind: 'idea', icon: 'pin', label: focus.name || 'dropped pin' })
    el.classList.add('gpin-focus')
    const m = new markerLib.current.AdvancedMarkerElement({ map, position: { lat: focus.lat, lng: focus.lng }, content: el, zIndex: 100 })
    map.panTo({ lat: focus.lat, lng: focus.lng })
    if ((map.getZoom() ?? 0) < 14) map.setZoom(15)
    return () => { m.map = null }
  }, [focus, map])

  const note = !online ? <MapNote title="the map needs a connection" />
    : state === 'none' ? <MapNote title="map not set up" detail="add a google maps key" />
    : state === 'auth' ? <MapNote title="google refused the map key" detail="check the key's allowed sites and billing" />
    : state === 'failed' ? <MapNote title="the map didn't load" onRetry={() => setTries((n) => n + 1)} />
    : null
  return <>
    <div ref={holder} className="trip-map-canvas" />
    {note}
    {!note && !map && <Loading label="loading map" />}
  </>
}
