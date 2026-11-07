import type { PointerEvent as RPointerEvent } from 'react'
import type { Stop } from '../../lib/types'
import { dayColor, nights } from '../../lib/dates'
import { Pill } from '../../components/Pill'
import { Icon } from '../../components/Icon'
import { SaveFailed } from '../../components/SaveFailed'

export type RowVariant = 'stop' | 'checkin' | 'staying' | 'checkout'

const MODE_ICON: Record<string, string> = { flight: 'plane', train: 'train', bus: 'bus', ferry: 'ferry' }

const routed = (s: Stop) => s.kind === 'journey' && !!s.origin?.name && !!s.destination?.name

export function stopTitle(s: Stop): string {
  if (routed(s)) return `${s.origin!.name} → ${s.destination!.name}`
  return s.title || (s.kind === 'journey' ? s.mode ?? 'journey' : s.place?.name ?? '')
}

export function stopSub(s: Stop): string {
  if (s.kind === 'journey') {
    const times = s.time ? (s.end_time ? `${s.time}–${s.end_time}` : s.time) : ''
    return [s.mode, routed(s) ? s.title : '', times].filter(Boolean).join(' · ')
  }
  if (s.kind === 'stay') {
    const n = nights(s.day, s.end_date)
    return [s.time, n ? `${n} ${n === 1 ? 'night' : 'nights'}` : ''].filter(Boolean).join(' · ')
  }
  if (s.kind === 'note') return (s.notes ?? '').split('\n')[0]
  // the time has its own column in a day
  return [s.category, s.place?.city || s.place?.address].filter(Boolean).join(' · ')
}

// a journey reads like a ticket: both ends in full, when it gets in, carrier and ref
function Ticket({ stop, pill }: { stop: Stop; pill: JSX.Element }) {
  const from = stop.origin?.name, to = stop.destination?.name
  const gets = stop.end_time ? `${stop.mode === 'flight' ? 'lands' : 'arrives'} ${stop.end_time}` : stop.destination?.city ?? ''
  return (
    <span className="journey-ticket">
      {from && to ? (
        <span className="journey-route"><span className="journey-end">{from}</span><span className="journey-line" aria-hidden="true" /><span className="journey-end">{to}</span></span>
      ) : <span className="journey-route"><span className="journey-end">{stopTitle(stop)}</span></span>}
      {(stop.origin?.city || gets) && <span className="journey-sub muted"><span>{stop.origin?.city ?? ''}</span><span>{gets}</span></span>}
      <span className="journey-foot">
        <span className="muted journey-what">{stop.mode && <Icon name={MODE_ICON[stop.mode] ?? 'train'} size={15} />}<span>{stop.title || stop.mode}{stop.ref && <>{' · '}<span className="keep-case">{stop.ref}</span></>}</span></span>
        {pill}
      </span>
    </span>
  )
}

type Props = {
  stop: Stop
  variant: RowVariant
  n?: number
  colorIndex: number
  clash?: boolean
  onOpen?: (s: Stop) => void
  onGrab?: (e: RPointerEvent<HTMLButtonElement>) => void
  dragging?: boolean
  offset?: number
  // an untimed stop on a day with times says "any" in the time column
  any?: boolean
}

const STRIP: Record<Exclude<RowVariant, 'stop'>, string> = { checkin: 'check in', staying: 'staying at', checkout: 'check out' }

export function StopRow({ stop, variant, n, colorIndex, clash, onOpen, onGrab, dragging, offset = 0, any }: Props) {
  if (variant !== 'stop') {
    const text = variant === 'staying' ? `staying at ${stop.title}` : `${STRIP[variant]} · ${stop.title}`
    return (
      <>
        <button type="button" className="stay-strip" data-stop={stop.id} onClick={() => onOpen?.(stop)} disabled={!onOpen}>
          <Icon name="bed" size={16} /><span>{text}</span>
          {variant === 'checkin' && <Pill status={stop.status} />}
        </button>
        {variant === 'checkin' && <SaveFailed table="stops" id={stop.id} />}
      </>
    )
  }
  const pill = clash ? <Pill status="warn" label="dates clash" /> : <Pill status={stop.status} />
  const journey = stop.kind === 'journey'
  return (
    <>
      <div className={`stop-row${dragging ? ' dragging' : ''}`} style={offset ? { transform: `translateY(${offset}px)` } : undefined} data-stop={stop.id}>
        <span className={`agenda-time num${stop.time ? '' : ' any'}`}>{stop.time ?? (any ? 'any' : '')}</span>
        {n != null ? <span className="num-badge num" data-testid="stop-num" style={{ background: dayColor(colorIndex) }}>{n}</span> : <span className="num-badge quiet" />}
        <button type="button" className="stop-main" onClick={() => onOpen?.(stop)} disabled={!onOpen}>
          {journey ? <Ticket stop={stop} pill={pill} /> : <>
            <span className="stop-title"><span>{stopTitle(stop)}</span></span>
            {stopSub(stop) && <span className="stop-sub muted">{stopSub(stop)}</span>}
          </>}
        </button>
        {!journey && pill}
        {onGrab && (
          <button type="button" className="grip" aria-label={`reorder ${stop.title}`} onPointerDown={onGrab}>
            <svg width="12" height="18" viewBox="0 0 12 18" aria-hidden="true"><g fill="currentColor">{[3, 9, 15].flatMap((y) => [<circle key={`a${y}`} cx="3" cy={y} r="1.4" />, <circle key={`b${y}`} cx="9" cy={y} r="1.4" />])}</g></svg>
          </button>
        )}
      </div>
      <SaveFailed table="stops" id={stop.id} />
    </>
  )
}
