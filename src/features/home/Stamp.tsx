import { useId, type CSSProperties } from 'react'
import { iconPath } from '../../components/Icon'
import { stampDate, stampStyle } from '../../lib/stampStyle'

// a passport stamp, drawn here so it works offline and wears the planner's fonts and the trip's colour.
// it's modelled on the real thing: every schengen country shares the european entry stamp (code in a ring of
// stars, how you came, the date, the port), japan, the uk and the us have their own, the rest a plain one.
// each country always gets the same tilt; the ink is a little uneven, like a real stamp
const hash = (s: string) => [...s].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7)

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const MODE_ICON: Record<string, string> = { flight: 'plane', train: 'train', bus: 'bus', ferry: 'ferry' }
// about how wide one letter is in each lettering (mono, with its letter spacing), in the stamp's own units
const PER: Record<string, number> = { 'stamp-big': 9.9, 'stamp-name': 7.2, 'stamp-small': 4.5, 'stamp-serial': 5.1, 'stamp-cc': 8 }
// words centred at x,y. given the room they have (w), words that would be wider are squeezed to fit, so nothing spills over the stamp's edge
const T = ({ className, x, y, w, children }: { className: string; x: number; y: number; w?: number; children: string }) => {
  const tight = w != null && children.length * (PER[className] ?? 7) > w
  return <text className={className} x={x} y={y} textAnchor="middle" fill="currentColor" stroke="none" {...(tight ? { textLength: w, lengthAdjust: 'spacingAndGlyphs' } : null)}>{children}</text>
}

type Props = { code: string; name: string; date: string; iso: string; port: string | null; mode: string | null }

export function Stamp({ code, name, date, iso, port, mode }: Props) {
  const id = useId().replace(/:/g, '')
  const h = hash(code)
  const shape = h % 3
  const tilt = (h % 17) - 8
  const ink = `url(#ink-${id})`
  const label = cut(name, 18)
  const style = stampStyle(code)
  const where = cut(port ?? name, 14)
  const when = stampDate(iso, style)
  const icon = mode ? MODE_ICON[mode] : undefined
  return (
    <svg className="stamp-art" viewBox="0 0 120 120" aria-hidden="true" data-style={style} style={{ '--tilt': `${tilt}deg` } as CSSProperties}>
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
        {style === 'schengen' && (<>
          <rect x="5" y="23" width="110" height="74" rx="8" strokeWidth="2.6" />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2
            return <circle key={i} className="stamp-star" cx={27 + Math.sin(a) * 13} cy={45 - Math.cos(a) * 13} r="1.15" fill="currentColor" stroke="none" />
          })}
          <T className="stamp-cc" x={27} y={49}>{code.toLowerCase()}</T>
          {icon && <g data-mode={mode}>
            <rect x="87" y="31" width="21" height="17" rx="2.5" strokeWidth="1.2" />
            <path d={iconPath(icon)} transform="translate(90.5 32.5) scale(.58)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </g>}
          <T className="stamp-serial" x={97.5} y={icon ? 57 : 46}>{String((h % 900) + 100)}</T>
          <T className="stamp-big" x={60} y={73} w={96}>{when}</T>
          <line x1="14" y1="79" x2="106" y2="79" strokeWidth="1" />
          <T className="stamp-name" x={60} y={90} w={96}>{where}</T>
        </>)}
        {style === 'japan' && (<>
          <rect x="7" y="20" width="106" height="80" strokeWidth="2.6" />
          <rect x="11.5" y="24.5" width="97" height="71" strokeWidth="1" />
          <T className="stamp-small" x={60} y={36} w={88}>landing permission</T>
          <line x1="16" y1="41" x2="104" y2="41" strokeWidth="1" />
          <T className="stamp-big" x={60} y={59} w={88}>{when}</T>
          <T className="stamp-small" x={60} y={71} w={88}>temporary visitor</T>
          <line x1="16" y1="77" x2="104" y2="77" strokeWidth="1" />
          <T className="stamp-name" x={60} y={89} w={88}>{where}</T>
        </>)}
        {style === 'uk' && (<>
          <path d="M22 22h76l16 16v44l-16 16H22L6 82V38z" strokeWidth="2.6" />
          <T className="stamp-small" x={60} y={38}>immigration officer</T>
          <T className="stamp-serial" x={60} y={50}>{`✱ (${(h % 9000) + 1000}) ✱`}</T>
          <T className="stamp-big" x={60} y={68} w={88}>{when}</T>
          <line x1="20" y1="75" x2="100" y2="75" strokeWidth="1" />
          <T className="stamp-name" x={60} y={88} w={76}>{where}</T>
        </>)}
        {style === 'usa' && (<>
          <rect x="5" y="24" width="110" height="72" rx="30" strokeWidth="2.6" />
          <rect x="10" y="29" width="100" height="62" rx="25" strokeWidth="1" strokeDasharray="3 2" />
          <T className="stamp-name" x={60} y={46}>admitted</T>
          <T className="stamp-big" x={60} y={64} w={84}>{when}</T>
          <T className="stamp-small" x={60} y={75}>class b2</T>
          <T className="stamp-small" x={60} y={84} w={64}>{where}</T>
        </>)}
        {style === 'plain' && shape === 0 && (<>
          <circle cx="60" cy="60" r="54" strokeWidth="3" />
          <circle cx="60" cy="60" r="41" strokeWidth="1.2" />
          <text className="stamp-ring" fill="currentColor" stroke="none"><textPath href={`#arc-${id}`} startOffset="50%" textAnchor="middle">{label}</textPath></text>
          <text className="stamp-ring" fill="currentColor" stroke="none"><textPath href={`#arc-low-${id}`} startOffset="50%" textAnchor="middle">★ arrived ★</textPath></text>
          <text className="stamp-code" x="60" y="64" textAnchor="middle" fill="currentColor" stroke="none">{code.toLowerCase()}</text>
          <text className="stamp-date" x="60" y="78" textAnchor="middle" fill="currentColor" stroke="none">{date}</text>
        </>)}
        {style === 'plain' && shape === 1 && (<>
          <rect x="8" y="22" width="104" height="76" rx="6" strokeWidth="3" />
          <rect x="14" y="28" width="92" height="64" rx="3" strokeWidth="1.2" />
          <T className="stamp-name" x={60} y={44} w={84}>{label}</T>
          <line x1="22" y1="50" x2="98" y2="50" strokeWidth="1" />
          <text className="stamp-code" x="60" y="72" textAnchor="middle" fill="currentColor" stroke="none">{code.toLowerCase()}</text>
          <text className="stamp-date" x="60" y="86" textAnchor="middle" fill="currentColor" stroke="none">{date}</text>
        </>)}
        {style === 'plain' && shape === 2 && (<>
          <ellipse cx="60" cy="60" rx="56" ry="42" strokeWidth="3" />
          <ellipse cx="60" cy="60" rx="48" ry="34" strokeWidth="1.2" strokeDasharray="3 2" />
          <T className="stamp-name" x={60} y={46} w={72}>{label}</T>
          <text className="stamp-code" x="60" y="70" textAnchor="middle" fill="currentColor" stroke="none">{code.toLowerCase()}</text>
          <text className="stamp-date" x="60" y="84" textAnchor="middle" fill="currentColor" stroke="none">{date}</text>
        </>)}
      </g>
    </svg>
  )
}
