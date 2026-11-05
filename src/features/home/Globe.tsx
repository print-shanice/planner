import { useEffect, useRef } from 'react'
import maplibregl, { type ExpressionSpecification, type StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

type Props = { status: Map<string, 'been' | 'planned'>; onCountry: (code: string) => void }

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

function mix(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const [x, y] = [p(a), p(b)]
  return `rgb(${x.map((v, i) => Math.round(v * t + y[i] * (1 - t))).join(',')})`
}

function fillFor(status: Map<string, 'been' | 'planned'>): ExpressionSpecification {
  const been = [...status].filter(([, s]) => s === 'been').map(([c]) => c)
  const planned = [...status].filter(([, s]) => s === 'planned').map(([c]) => c)
  const land = css('--map-land'), ink = css('--g0')
  return ['case',
    ['in', ['get', 'ISO_A2'], ['literal', been]], ink,
    ['in', ['get', 'ISO_A2'], ['literal', planned]], mix(ink, land, 0.35),
    land,
  ]
}

export function Globe({ status, onCountry }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const latest = useRef({ status, onCountry })
  latest.current = { status, onCountry }

  useEffect(() => {
    if (!box.current) return
    const style: StyleSpecification = {
      version: 8,
      projection: { type: 'globe' },
      sources: { countries: { type: 'geojson', data: `${import.meta.env.BASE_URL}countries-110m.geojson` } },
      layers: [
        { id: 'water', type: 'background', paint: { 'background-color': css('--map-water') } },
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

    m.on('click', 'countries-fill', (e) => {
      const code = e.features?.[0]?.properties?.ISO_A2 as string | undefined
      if (code && latest.current.status.has(code)) latest.current.onCountry(code)
    })
    m.on('mousemove', 'countries-fill', (e) => {
      const code = e.features?.[0]?.properties?.ISO_A2 as string | undefined
      m.getCanvas().style.cursor = code && latest.current.status.has(code) ? 'pointer' : ''
    })
    m.on('mouseleave', 'countries-fill', () => { m.getCanvas().style.cursor = '' })

    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    let pausedUntil = 0
    let down = false
    const pause = () => { down = true }
    const resume = () => { down = false; pausedUntil = performance.now() + 3000 }
    const canvas = m.getCanvasContainer()
    canvas.addEventListener('pointerdown', pause)
    window.addEventListener('pointerup', resume)
    window.addEventListener('pointercancel', resume)
    const spin = (now: number) => {
      if (!down && now > pausedUntil && !m.isMoving()) {
        const c = m.getCenter()
        m.jumpTo({ center: [c.lng + 0.04, c.lat] })
      }
      frame = requestAnimationFrame(spin)
    }
    if (!still) m.once('load', () => { frame = requestAnimationFrame(spin) })

    return () => {
      cancelAnimationFrame(frame)
      canvas.removeEventListener('pointerdown', pause)
      window.removeEventListener('pointerup', resume)
      window.removeEventListener('pointercancel', resume)
      m.remove()
      map.current = null
    }
  }, [])

  useEffect(() => {
    const m = map.current
    if (!m) return
    const apply = () => m.setPaintProperty('countries-fill', 'fill-color', fillFor(status))
    if (m.isStyleLoaded()) apply()
    else m.once('load', apply)
  }, [status])

  return <div ref={box} className="globe" role="img" aria-label="globe of countries" />
}
