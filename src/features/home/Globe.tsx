import { useEffect, useId, useRef, useState } from 'react'
import maplibregl, { type ExpressionSpecification, type StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { GlobePin } from '../../lib/countries'
import { GlobeTip } from './GlobeTip'

type Status = Map<string, 'been' | 'planned'>
type Props = { status: Status; pins: GlobePin[]; onCountry: (code: string) => void }
type Placed = { pin: GlobePin; marker: maplibregl.Marker; el: HTMLButtonElement }

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

// red = been there, pale red = planned
export function fillFor(status: Status): ExpressionSpecification {
  const been = [...status].filter(([, s]) => s === 'been').map(([c]) => c)
  const planned = [...status].filter(([, s]) => s === 'planned').map(([c]) => c)
  return ['case',
    ['in', ['get', 'ISO_A2'], ['literal', been]], css('--been'),
    ['in', ['get', 'ISO_A2'], ['literal', planned]], css('--been-soft'),
    css('--map-land'),
  ]
}

export function Globe({ status, pins, onCountry }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const placed = useRef<Placed[]>([])
  const open = useRef<string | null>(null)
  const touch = useRef(false)
  const [tip, setTip] = useState<{ code: string; x: number; y: number } | null>(null)
  const tipId = useId()
  const latest = useRef({ status, onCountry })
  latest.current = { status, onCountry }

  // pins on the far side of the globe hide; the open tip follows its pin, or closes with it
  function place() {
    const m = map.current
    if (!m) return
    let at: { x: number; y: number } | null = null
    for (const { pin, marker, el } of placed.current) {
      const hidden = m.transform.isLocationOccluded(marker.getLngLat())
      el.style.visibility = hidden ? 'hidden' : ''
      if (pin.code === open.current && !hidden) {
        at = m.project(marker.getLngLat())
        el.setAttribute('aria-describedby', tipId)
      } else {
        el.removeAttribute('aria-describedby')
      }
    }
    if (!at) open.current = null
    setTip(at && open.current ? { code: open.current, x: at.x, y: at.y } : null)
  }

  function show(code: string) { open.current = code; place() }
  function hide() { open.current = null; place() }

  // phones have no hover: the first tap shows the tip, the second opens the country
  function choose(code: string) {
    const pinned = placed.current.some((x) => x.pin.code === code)
    if (touch.current && pinned && open.current !== code) show(code)
    else latest.current.onCountry(code)
  }

  useEffect(() => {
    if (!box.current) return
    const style: StyleSpecification = {
      version: 8,
      projection: { type: 'globe' },
      sources: { countries: { type: 'geojson', data: `${import.meta.env.BASE_URL}countries-110m.geojson` } },
      layers: [
        { id: 'water', type: 'background', paint: { 'background-color': css('--globe-water') } },
        { id: 'countries-fill', type: 'fill', source: 'countries', paint: { 'fill-color': fillFor(latest.current.status) } },
        { id: 'countries-line', type: 'line', source: 'countries', paint: { 'line-color': css('--ground'), 'line-width': 0.6 } },
      ],
    }
    let m: maplibregl.Map
    try {
      m = new maplibregl.Map({
        container: box.current, style, center: [10, 30], zoom: 0.9, minZoom: 0.6, maxZoom: 4,
        attributionControl: false, scrollZoom: false, dragRotate: false, pitchWithRotate: false,
        renderWorldCopies: false,
      })
    } catch {
      return // no webgl: the rest of home still works
    }
    map.current = m
    m.touchZoomRotate.disableRotation()

    m.on('click', (e) => {
      if ((e.originalEvent?.target as Element | null)?.closest?.('.globe-pin')) return
      const code = m.queryRenderedFeatures(e.point, { layers: ['countries-fill'] })[0]?.properties?.ISO_A2 as string | undefined
      if (code && latest.current.status.has(code)) choose(code)
      else hide()
    })
    m.on('mousemove', 'countries-fill', (e) => {
      const code = e.features?.[0]?.properties?.ISO_A2 as string | undefined
      m.getCanvas().style.cursor = code && latest.current.status.has(code) ? 'pointer' : ''
    })
    m.on('mouseleave', 'countries-fill', () => { m.getCanvas().style.cursor = '' })
    m.on('move', place)

    return () => {
      for (const x of placed.current) x.marker.remove()
      placed.current = []
      m.remove()
      map.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = map.current
    if (!m) return
    const apply = () => m.setPaintProperty('countries-fill', 'fill-color', fillFor(status))
    if (m.isStyleLoaded()) apply()
    else m.once('load', apply)
  }, [status])

  // pins are real buttons: focusable, and they need no map font
  useEffect(() => {
    const m = map.current
    if (!m) return
    for (const x of placed.current) x.marker.remove()
    placed.current = pins.map((pin) => {
      const el = document.createElement('button')
      el.type = 'button'
      el.className = 'globe-pin'
      el.dataset.status = pin.status
      el.setAttribute('aria-label', pin.name)
      el.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') show(pin.code) })
      el.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') hide() })
      el.addEventListener('focus', () => show(pin.code))
      el.addEventListener('blur', hide)
      el.addEventListener('click', () => choose(pin.code))
      const marker = new maplibregl.Marker({ element: el }).setLngLat([pin.lng, pin.lat]).addTo(m)
      return { pin, marker, el }
    })
    place()
  }, [pins]) // eslint-disable-line react-hooks/exhaustive-deps

  const pin = tip ? pins.find((p) => p.code === tip.code) : undefined
  return (
    <div className="globe-wrap" onPointerDownCapture={(e) => { touch.current = e.pointerType === 'touch' }}>
      <div ref={box} className="globe" role="region" aria-label="globe" />
      {tip && pin && <GlobeTip id={tipId} pin={pin} x={tip.x} y={tip.y} width={box.current?.clientWidth ?? 0} />}
    </div>
  )
}
