import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'
import type { DayEntry } from '../../lib/dates'
import type { Stop } from '../../lib/types'
import { marked, normal } from '../../lib/itinerary'
import { useFiles, useSave } from '../../lib/queries'
import { useUndoRemove } from '../../lib/undo'
import { couldBeTime, readTime } from '../../lib/time'
import { useCanEdit } from '../../lib/offline'
import { Pill } from '../../components/Pill'
import { Icon } from '../../components/Icon'
import { SaveFailed } from '../../components/SaveFailed'
import { Pending } from '../../components/Pending'
import { stopSub, stopTitle } from '../plan/StopRow'
import { readLine, type LineValues } from './LineEditor'
import { categoryIcon, categoryOf } from '../../lib/categories'
import type { ReactNode } from 'react'

// the kind of place, in the colour of the trip that owns the day (stays and ideas stay ink and grey)
export function Chip({ stop, quiet }: { stop: Stop; quiet?: boolean }) {
  const c = categoryOf(stop)
  return <span className={`cat${quiet ? ' quiet' : ''}${stop.kind === 'stay' ? ' bed' : ''}`} title={c}><Icon name={stop.kind === 'journey' && stop.mode === 'flight' ? 'plane' : stop.kind === 'journey' ? stop.mode ?? 'train' : categoryIcon(c)} size={15} /></span>
}

const STAY: Record<string, string> = { checkin: 'check in', staying: 'staying at', checkout: 'check out' }

// a booking ref keeps its own letters (the rest of the planner is lowercase): it's read out at a desk
function Sub({ text, refCode, q }: { text: string; refCode: string; q: string }) {
  const at = refCode ? text.indexOf(refCode) : -1
  if (at < 0) return <Marked text={text} q={q} />
  return <><Marked text={text.slice(0, at)} q={q} /><span className="keep-case"><Marked text={refCode} q={q} /></span><Marked text={text.slice(at + refCode.length)} q={q} /></>
}

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
  day?: string | null
  onOpen?: (s: Stop, day?: string | null) => void
  onLight?: (id: string | null) => void
  editing?: boolean
  // the reorder handle, for untimed lines
  grip?: ReactNode
  // how many tickets or files it has
  files?: number
}

// one line of the doc: the time on the left, what it is on the right. a place or a note is live text you type over
export function ItinLine(props: Props) {
  const { entry, q } = props
  const canEdit = useCanEdit()
  const [live, setLive] = useState(false)
  const s = entry.stop!
  const editable = canEdit && props.editing === true && entry.kind === 'stop' && (s.kind === 'place' || s.kind === 'note')
  // while searching, lines show their matches; tapping one makes it live again
  if (editable && (!q || live)) return <DocLine {...props} autoFocus={live} />
  return <StaticLine {...props} onEdit={editable ? () => setLive(true) : undefined} />
}

function StaticLine({ entry, any, q, current, day, onOpen, onLight, onEdit, grip, files }: Props & { onEdit?: () => void }) {
  const s = entry.stop!
  const stay = entry.kind !== 'stop'
  const title = stay ? `${STAY[entry.kind]} · ${s.title}` : stopTitle(s)
  const sub = stay ? '' : subOf(s)
  const note = snippet(s, q)
  const when = timeOf(entry, any)
  const words = <>
    <span className="itin-title"><Marked text={title} q={q} /></span>
    {sub && <span className="itin-sub muted"><Sub text={sub} refCode={s.ref} q={q} /></span>}
    {note && <span className="itin-snippet muted"><Marked text={note} q={q} /></span>}
  </>
  return (
    <>
      <div className={`itin-line${stay ? ' quiet' : ''}${current ? ' current' : ''}`} data-line={s.id} data-testid="itin-line"
        onMouseEnter={() => onLight?.(s.id)} onMouseLeave={() => onLight?.(null)}>
        <span className="itin-time num" aria-label={when.till ? `${when.from} to ${when.till}` : undefined}>
          <span>{when.from}</span>{when.till && <span className="till">–{when.till}</span>}
        </span>
        <Chip stop={s} quiet={stay} />
        <button type="button" className="itin-main" onClick={() => (onEdit ? onEdit() : onOpen?.(s, day))} disabled={!onEdit && !onOpen}
          onFocus={() => onLight?.(s.id)} onBlur={() => onLight?.(null)}>{words}</button>
        <span className="itin-end">
          {!!files && <span className="itin-files" aria-label={`${files} ${files === 1 ? 'ticket' : 'tickets'}`}><Icon name="file" size={15} /></span>}
          {(entry.kind === 'stop' || entry.kind === 'checkin') && <Pill status={s.status} />}
          {grip}
          {onEdit && onOpen && <button type="button" className="icon-btn itin-open" aria-label={`open ${title}`} onClick={() => onOpen(s, day)}><Icon name="next" size={18} /></button>}
        </span>
      </div>
      {entry.kind !== 'staying' && entry.kind !== 'checkout' && <SaveFailed table="stops" id={s.id} />}
    </>
  )
}

const valuesOf = (s: Stop): LineValues => ({ time: s.time ?? '', end: s.end_time ?? '', title: s.title })

// the next line's name, or the day's empty line, so enter moves down the doc
function focusNext(from: HTMLElement | null) {
  const all = [...document.querySelectorAll<HTMLInputElement>('[data-doc-name], .add-line .line-name')]
  all[all.indexOf(from as HTMLInputElement) + 1]?.focus()
}

function DocLine({ entry, any, current, day, onOpen, onLight, autoFocus, grip, files: count }: Props & { autoFocus?: boolean }) {
  const s = entry.stop!
  const save = useSave('stops')
  const removeLater = useUndoRemove('stops')
  const files = useFiles().data ?? []
  const [v, setV] = useState(() => valuesOf(s))
  const [problem, setProblem] = useState<string | null>(null)
  const [timeOpen, setTimeOpen] = useState(false)
  // a save says so: "saving…" while it goes, then "saved" for a moment
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const quiet = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(quiet.current), [])
  const box = useRef<HTMLDivElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  // what's on screen and what was last saved, read fresh from handlers that fire as focus moves
  const now = useRef(v)
  now.current = v
  const saved = useRef(valuesOf(s))
  const gone = useRef(false)
  const put = (x: LineValues) => { now.current = x; setV(x) }
  // someone else's change shows, unless you're typing on this line
  useEffect(() => {
    saved.current = valuesOf(s)
    if (!box.current?.contains(document.activeElement)) put(valuesOf(s))
  }, [s.time, s.end_time, s.title]) // eslint-disable-line react-hooks/exhaustive-deps

  const title = stopTitle(s)
  const sub = stopSub(s)
  const when = timeOf(entry, any)
  const was = saved.current
  const dirty = v.title !== was.title || v.time !== was.time || v.end !== was.end

  function commit(): boolean {
    if (gone.current) return true
    const read = readLine(now.current)
    if ('problem' in read) { setProblem(read.problem); return false }
    const line = { ...read.line, title: read.line.title.trim() }
    setProblem(null)
    if (!line.title) {
      // an emptied line goes, with undo; one holding tickets only goes from its card
      if (files.some((f) => f.stop_id === s.id)) put(saved.current)
      else { gone.current = true; removeLater(s.id) }
      return true
    }
    const was = saved.current
    const changed: Record<string, string | null> = {}
    if (line.title !== was.title) changed.title = line.title
    if (line.time !== was.time) changed.time = line.time || null
    if (line.end !== was.end) changed.end_time = line.end || null
    saved.current = line
    put(line)
    if (Object.keys(changed).length) {
      clearTimeout(quiet.current)
      setState('saving')
      save.mutateAsync({ id: s.id, ...changed })
        .then(() => { setState('saved'); quiet.current = setTimeout(() => setState('idle'), 1800) })
        .catch(() => setState('idle')) // "couldn't save" shows under the line, with retry
    }
    return true
  }
  function key(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); if (commit()) focusNext(nameRef.current) }
    if (e.key === 'Escape') { e.preventDefault(); put(saved.current); setProblem(null); e.currentTarget.blur() }
  }
  function leave(e: FocusEvent<HTMLDivElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    setTimeOpen(false)
    onLight?.(null)
    commit()
  }
  const typeTime = (k: 'time' | 'end', x: string) => { if (couldBeTime(x)) put({ ...now.current, [k]: x }) }
  const tidy = (k: 'time' | 'end') => { const t = readTime(now.current[k]); if (t) put({ ...now.current, [k]: t }) }

  return (
    <>
      <div ref={box} className={`itin-line doc${current ? ' current' : ''}`} data-line={s.id} data-testid="itin-line"
        onMouseEnter={() => onLight?.(s.id)} onMouseLeave={() => onLight?.(null)} onFocus={() => onLight?.(s.id)} onBlur={leave}>
        <span className="itin-time num" onFocus={() => setTimeOpen(true)}>
          <input type="text" className={`doc-time${when.from === 'any' ? '' : ' quiet'}`} aria-label={`start time of ${title}`} placeholder="any" value={v.time}
            inputMode="decimal" autoComplete="off" onChange={(e) => typeTime('time', e.target.value)} onBlur={() => tidy('time')} onKeyDown={key} />
          {(v.end || timeOpen) && <input type="text" className="doc-time till" aria-label={`end time of ${title}`} placeholder="end" value={v.end}
            inputMode="decimal" autoComplete="off" onChange={(e) => typeTime('end', e.target.value)} onBlur={() => tidy('end')} onKeyDown={key} />}
        </span>
        <Chip stop={s} />
        <span className="itin-main">
          <input ref={nameRef} type="text" className="doc-name" data-doc-name="" aria-label={`change ${title}`} value={v.title} autoComplete="off"
            enterKeyHint="next" autoFocus={autoFocus} onChange={(e) => put({ ...now.current, title: e.target.value })} onKeyDown={key} />
          {sub && <span className="itin-sub muted">{sub}</span>}
          {problem && <span className="warn-line">{problem}</span>}
        </span>
        <span className="itin-end">
        {!!count && <span className="itin-files" aria-label={`${count} ${count === 1 ? 'ticket' : 'tickets'}`}><Icon name="file" size={15} /></span>}
        <Pill status={s.status} />
        {grip}
        {dirty
          ? <button type="button" className="btn small line-go" aria-label={`save ${title}`} onClick={() => { if (commit()) nameRef.current?.blur() }}>save</button>
          : state === 'saving' ? <Pending label="saving" className="line-state" />
          : state === 'saved' ? <span className="line-state muted" role="status"><Icon name="check" size={15} />saved</span>
          : onOpen ? <button type="button" className="icon-btn itin-open" aria-label={`open ${title}`} onClick={() => onOpen(s, day)}><Icon name="next" size={18} /></button> : <span />}
        </span>
      </div>
      <SaveFailed table="stops" id={s.id} />
    </>
  )
}
