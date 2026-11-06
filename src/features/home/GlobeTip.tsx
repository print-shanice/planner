import type { CSSProperties } from 'react'
import type { GlobePin } from '../../lib/countries'

const EDGE = 110 // half the widest tip

export function cityLine(cities: string[], max = 4): string {
  const shown = cities.slice(0, max).join(' · ')
  return cities.length > max ? `${shown} +${cities.length - max}` : shown
}

// x/y are the pin's spot inside the globe box; near the sides the tip slides inward and its arrow stays on the pin
export function GlobeTip({ id, pin, x, y, width }: { id: string; pin: GlobePin; x: number; y: number; width: number }) {
  const left = width > EDGE * 2 ? Math.min(Math.max(x, EDGE), width - EDGE) : x
  return (
    <div id={id} role="tooltip" className="globe-tip" data-status={pin.status}
      style={{ left, top: y, '--arrow': `${x - left}px` } as CSSProperties}>
      <strong className="head">{pin.name}</strong>
      {pin.cities.length > 0 && <span>{cityLine(pin.cities)}</span>}
    </div>
  )
}
