import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { GlobePin } from '../../lib/countries'

const WIDEST = 220 // the tip's max-width
const ROUND = 14 // the tip's corner radius: the arrow stays inside it

export function cityLine(cities: string[], max = 4): string {
  const shown = cities.slice(0, max).join(' · ')
  return cities.length > max ? `${shown} +${cities.length - max}` : shown
}

// x/y are the pin's spot inside the globe box; near the sides the tip slides inward and its arrow stays on the pin
export function GlobeTip({ id, pin, x, y, width }: { id: string; pin: GlobePin; x: number; y: number; width: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(WIDEST)
  const words = `${pin.name}|${pin.cities.join()}`
  useLayoutEffect(() => { const m = ref.current?.offsetWidth; if (m) setW(m) }, [words])
  const half = w / 2
  const left = width > w ? Math.min(Math.max(x, half), width - half) : x
  const arrow = Math.max(-(half - ROUND), Math.min(half - ROUND, x - left))
  return (
    <div ref={ref} id={id} role="tooltip" className="globe-tip" data-status={pin.status}
      style={{ left, top: y, '--arrow': `${arrow}px` } as CSSProperties}>
      <strong className="head">{pin.name}</strong>
      {pin.cities.length > 0 && <span>{cityLine(pin.cities)}</span>}
    </div>
  )
}
