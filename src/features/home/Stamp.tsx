import { useId, type CSSProperties } from 'react'

// a passport stamp, drawn here so it works offline and wears the planner's fonts and the trip's colour.
// each country always gets the same shape and tilt; the ink is a little uneven, like a real stamp
const hash = (s: string) => [...s].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7)

export function Stamp({ code, name, date }: { code: string; name: string; date: string }) {
  const id = useId().replace(/:/g, '')
  const h = hash(code)
  const shape = h % 3
  const tilt = (h % 17) - 8
  const ink = `url(#ink-${id})`
  const label = name.length > 18 ? `${name.slice(0, 17)}…` : name
  return (
    <svg className="stamp-art" viewBox="0 0 120 120" aria-hidden="true" style={{ '--tilt': `${tilt}deg` } as CSSProperties}>
      <defs>
        <filter id={`ink-${id}`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed={h % 50} result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.6" xChannelSelector="R" yChannelSelector="G" result="rough" />
          <feComponentTransfer in="noise" result="speckle"><feFuncA type="discrete" tableValues="1 1 1 1 0.8 1 1 1" /></feComponentTransfer>
          <feComposite in="rough" in2="speckle" operator="in" />
        </filter>
        <path id={`arc-${id}`} d="M 15.5 60 A 44.5 44.5 0 0 1 104.5 60" />
        <path id={`arc-low-${id}`} d="M 10 60 A 50 50 0 0 0 110 60" />
      </defs>
      <g filter={ink} fill="none" stroke="currentColor">
        {shape === 0 && (<>
          <circle cx="60" cy="60" r="54" strokeWidth="3" />
          <circle cx="60" cy="60" r="41" strokeWidth="1.2" />
          <text className="stamp-ring" fill="currentColor" stroke="none"><textPath href={`#arc-${id}`} startOffset="50%" textAnchor="middle">{label}</textPath></text>
          <text className="stamp-ring" fill="currentColor" stroke="none"><textPath href={`#arc-low-${id}`} startOffset="50%" textAnchor="middle">★ arrived ★</textPath></text>
          <text className="stamp-code" x="60" y="64" textAnchor="middle" fill="currentColor" stroke="none">{code.toLowerCase()}</text>
          <text className="stamp-date" x="60" y="78" textAnchor="middle" fill="currentColor" stroke="none">{date}</text>
        </>)}
        {shape === 1 && (<>
          <rect x="8" y="22" width="104" height="76" rx="6" strokeWidth="3" />
          <rect x="14" y="28" width="92" height="64" rx="3" strokeWidth="1.2" />
          <text className="stamp-name" x="60" y="44" textAnchor="middle" fill="currentColor" stroke="none">{label}</text>
          <line x1="22" y1="50" x2="98" y2="50" strokeWidth="1" />
          <text className="stamp-code" x="60" y="72" textAnchor="middle" fill="currentColor" stroke="none">{code.toLowerCase()}</text>
          <text className="stamp-date" x="60" y="86" textAnchor="middle" fill="currentColor" stroke="none">{date}</text>
        </>)}
        {shape === 2 && (<>
          <ellipse cx="60" cy="60" rx="56" ry="42" strokeWidth="3" />
          <ellipse cx="60" cy="60" rx="48" ry="34" strokeWidth="1.2" strokeDasharray="3 2" />
          <text className="stamp-name" x="60" y="46" textAnchor="middle" fill="currentColor" stroke="none">{label}</text>
          <text className="stamp-code" x="60" y="70" textAnchor="middle" fill="currentColor" stroke="none">{code.toLowerCase()}</text>
          <text className="stamp-date" x="60" y="84" textAnchor="middle" fill="currentColor" stroke="none">{date}</text>
        </>)}
      </g>
    </svg>
  )
}
