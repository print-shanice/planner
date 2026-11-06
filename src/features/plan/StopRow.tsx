import type { PointerEvent as RPointerEvent } from 'react'
import type { Stop } from '../../lib/types'
import { dayColor, nights } from '../../lib/dates'
import { Pill } from '../../components/Pill'
import { Icon } from '../../components/Icon'
import { SaveFailed } from '../../components/SaveFailed'

export type RowVariant = 'stop' | 'staying' | 'checkout'

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
  return [s.time, s.place?.city ?? s.place?.address].filter(Boolean).join(' · ')
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
}

export function StopRow({ stop, variant, n, colorIndex, clash, onOpen, onGrab, dragging, offset = 0 }: Props) {
  const title = variant === 'staying' ? `staying at ${stop.title}` : variant === 'checkout' ? `check out · ${stop.title}` : stopTitle(stop)
  const sub = variant === 'stop' ? stopSub(stop) : ''
  const mark = variant === 'stop' && n != null
    ? <span className="num-badge num" data-testid="stop-num" style={{ background: dayColor(colorIndex) }}>{n}</span>
    : <span className="num-badge quiet"><Icon name="bed" size={16} /></span>
  return (
    <>
      <div className={`stop-row${dragging ? ' dragging' : ''}`} style={offset ? { transform: `translateY(${offset}px)` } : undefined} data-stop={stop.id}>
        {mark}
        <button type="button" className="stop-main" onClick={() => onOpen?.(stop)} disabled={!onOpen}>
          <span className="stop-title">
            {stop.kind === 'journey' && stop.mode && <Icon name={MODE_ICON[stop.mode] ?? 'train'} size={16} />}
            <span>{title}</span>
          </span>
          {sub && <span className="stop-sub muted">{sub}</span>}
        </button>
        {variant === 'stop' && (clash ? <Pill status="warn" label="dates clash" /> : <Pill status={stop.status} />)}
        {onGrab && variant === 'stop' && (
          <button type="button" className="grip" aria-label={`reorder ${stop.title}`} onPointerDown={onGrab}>
            <svg width="12" height="18" viewBox="0 0 12 18" aria-hidden="true"><g fill="currentColor">{[3, 9, 15].flatMap((y) => [<circle key={`a${y}`} cx="3" cy={y} r="1.4" />, <circle key={`b${y}`} cx="9" cy={y} r="1.4" />])}</g></svg>
          </button>
        )}
      </div>
      {variant === 'stop' && <SaveFailed table="stops" id={stop.id} />}
    </>
  )
}
