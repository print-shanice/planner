import { useState } from 'react'
import type { DayEntry } from '../../lib/dates'
import type { Stop } from '../../lib/types'
import { marked, normal } from '../../lib/itinerary'
import { useSave } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { Pill } from '../../components/Pill'
import { Icon } from '../../components/Icon'
import { SaveFailed } from '../../components/SaveFailed'
import { stopSub, stopTitle } from '../plan/StopRow'
import { LineEditor, type LineValues } from './LineEditor'

const STAY: Record<string, string> = { checkin: 'check in', staying: 'staying at', checkout: 'check out' }

export function Marked({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>
  return <>{marked(text, q).map((p, i) => (p.hit ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))}</>
}

function timeOf(e: DayEntry, any: boolean): { from: string; till?: string } {
  const s = e.stop!
  if (e.kind === 'staying') return { from: '' }
  if (e.kind === 'checkout') return { from: s.end_time ?? '' }
  if (!s.time) return { from: any ? 'any' : '' }
  return s.end_time && s.kind !== 'journey' && s.kind !== 'stay' ? { from: s.time, till: s.end_time } : { from: s.time }
}

function subOf(s: Stop): string {
  if (s.kind !== 'journey') return stopSub(s)
  const gets = s.end_time ? `${s.mode === 'flight' ? 'lands' : 'arrives'} ${s.end_time}` : ''
  const routed = !!s.origin?.name && !!s.destination?.name
  return [routed ? s.title : '', s.ref, gets].filter(Boolean).join(' · ')
}

// the line of the notes a search found, when nothing else on the line shows why it matched
function snippet(s: Stop, q: string): string | null {
  const nq = normal(q.trim())
  if (!nq || !s.notes) return null
  const shown = [stopTitle(s), subOf(s)].map(normal).join(' ')
  if (shown.includes(nq)) return null
  return s.notes.split('\n').find((l) => normal(l).includes(nq)) ?? null
}

type Props = {
  entry: DayEntry
  any: boolean
  q: string
  current: boolean
  onOpen?: (s: Stop) => void
  onLight?: (id: string | null) => void
}

// one line of the doc: the time on the left, what it is on the right. a place or a note changes in place
export function ItinLine({ entry, any, q, current, onOpen, onLight }: Props) {
  const s = entry.stop!
  const save = useSave('stops')
  const canEdit = useCanEdit()
  const [editing, setEditing] = useState<'time' | 'title' | null>(null)
  const stay = entry.kind !== 'stop'
  const title = stay ? `${STAY[entry.kind]} · ${s.title}` : stopTitle(s)
  const sub = stay ? '' : subOf(s)
  const note = snippet(s, q)
  const when = timeOf(entry, any)
  const editable = canEdit && entry.kind === 'stop' && (s.kind === 'place' || s.kind === 'note')
  const light = { onMouseEnter: () => onLight?.(s.id), onMouseLeave: () => onLight?.(null) }

  function change(v: LineValues): string | null {
    const next = { title: v.title.trim(), time: v.time || null, end_time: v.end || null }
    if (!next.title) return 'add a name'
    const changed = Object.fromEntries(Object.entries(next).filter(([k, x]) => x !== ((s as Record<string, unknown>)[k] ?? null)))
    if (Object.keys(changed).length) save.mutateAsync({ id: s.id, ...changed }).catch(() => { /* "couldn't save" shows on the line */ })
    setEditing(null)
    return null
  }

  if (editing) {
    return (
      <div className="itin-line editing" data-line={s.id} data-testid="itin-line">
        <LineEditor label={`change ${title}`} saveOnLeave focus={editing} onSubmit={change} onCancel={() => setEditing(null)}
          initial={{ time: s.time ?? '', end: s.end_time ?? '', title: s.title }} />
      </div>
    )
  }

  const words = <>
    <span className="itin-title"><Marked text={title} q={q} /></span>
    {sub && <span className="itin-sub muted"><Marked text={sub} q={q} /></span>}
    {note && <span className="itin-snippet muted"><Marked text={note} q={q} /></span>}
  </>
  const timeText = <><span>{when.from}</span>{when.till && <span className="till">–{when.till}</span>}</>
  return (
    <>
      <div className={`itin-line${stay ? ' quiet' : ''}${editable ? ' editable' : ''}${current ? ' current' : ''}`} data-line={s.id} data-testid="itin-line" {...light}>
        {editable
          ? <button type="button" className="itin-time num" aria-label={`change time of ${title}`} onClick={() => setEditing('time')}>{timeText}</button>
          : <span className="itin-time num" aria-label={when.till ? `${when.from} to ${when.till}` : undefined}>{timeText}</span>}
        {editable
          ? <button type="button" className="itin-main" aria-label={`change ${title}`} onClick={() => setEditing('title')}
              onFocus={() => onLight?.(s.id)} onBlur={() => onLight?.(null)}>{words}</button>
          : <button type="button" className="itin-main" onClick={() => onOpen?.(s)} disabled={!onOpen}
              onFocus={() => onLight?.(s.id)} onBlur={() => onLight?.(null)}>{words}</button>}
        {(entry.kind === 'stop' || entry.kind === 'checkin') ? <Pill status={s.status} /> : <span />}
        {editable && onOpen && <button type="button" className="icon-btn itin-open" aria-label={`open ${title}`} onClick={() => onOpen(s)}><Icon name="next" size={18} /></button>}
      </div>
      {entry.kind !== 'staying' && entry.kind !== 'checkout' && <SaveFailed table="stops" id={s.id} />}
    </>
  )
}
