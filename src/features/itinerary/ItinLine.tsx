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
import { useArmed } from '../../components/TwoTapDelete'
import { stopSub, stopTitle } from '../plan/stopText'
import { readLine, type LineValues } from './LineEditor'
import { categoryIcon, categoryOf } from '../../lib/categories'
import { NO_INFO, type LineInfo } from '../../lib/lineInfo'
import { Tooltip } from '../../components/Tooltip'
import { useSettle } from './useSettle'
import { Marker } from './Marker'
import { useWide } from '../../lib/useWide'
import { useSwipeAway } from '../../lib/swipe'
import { useSaveNote } from '../../lib/saveNote'
import { modeIcon } from '../../lib/lineKind'
import { count } from '../../lib/words'

// the kind of place, in the colour of the trip that owns the day (stays and ideas stay ink and grey)
export function Chip({ stop, quiet }: { stop: Stop; quiet?: boolean }) {
  const c = categoryOf(stop)
  return <span className={`cat${quiet ? ' quiet' : ''}${stop.kind === 'stay' ? ' bed' : ''}`} title={c}><Icon name={stop.kind === 'journey' ? modeIcon(stop.mode) : categoryIcon(c)} size={15} /></span>
}

// a numbered line: "01", the same number as its pin on the map, so the list and the map read together
export function Seq({ n }: { n: number }) {
  return <span className="seq num" aria-hidden="true">{String(n).padStart(2, '0')}</span>
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
  // a journey's arrival is its end time, shown like any other (shanice, 13 nov), not as "lands" under its name
  return s.end_time && s.kind !== 'stay' ? { from: s.time, till: s.end_time } : { from: s.time }
}

function subOf(s: Stop): string {
  if (s.kind !== 'journey') return stopSub(s)
  const routed = !!s.origin?.name && !!s.destination?.name
  return [routed ? s.title : '', s.ref].filter(Boolean).join(' · ')
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
  // what the line holds beyond its name: note, ref, tickets, cost, links
  info?: LineInfo
  // its number on the day (and on the map)
  seq?: number
}

// the quiet row under a name: everything its card holds, so nothing is hidden behind the name
function InfoRow({ info, q }: { info: LineInfo; q: string }) {
  const bits = !!info.ref || !!info.flight || info.tickets > 0 || !!info.cost
  if (!bits && !info.note) return null
  return (
    <>
      {info.note && <span className="itin-note"><Marked text={info.note} q={q} /></span>}
      {bits && <span className="itin-bits mono">
        {info.ref && <span className="bit"><span className="bit-key">ref</span><span className="keep-case"><Marked text={info.ref} q={q} /></span></span>}
        {info.flight && <span className={`bit${info.flight.warn ? ' warn' : ''}`}><Icon name="plane" size={13} /><span>{info.flight.text}</span></span>}
        {info.tickets > 0 && <span className="bit"><Icon name="file" size={13} /><span>{count(info.tickets, 'ticket')}</span></span>}
        {info.cost && <span className={`bit${info.cost.paid ? ' paid' : ''}`}><Icon name="money" size={13} /><span>{info.cost.text}</span></span>}
      </span>}
    </>
  )
}
const hasInfo = (i: LineInfo) => !!(i.note || i.ref || i.flight || i.tickets || i.cost)

// a line's links: one small icon each, right of the name
function LineLinks({ info }: { info: LineInfo }) {
  return <>{info.links.slice(0, 3).map((l) => (
    <a key={l.url} className="icon-btn line-link" href={l.url} target="_blank" rel="noopener noreferrer" aria-label={`open ${l.label}`} title={l.label}><Icon name="link" size={16} /></a>
  ))}</>
}

// × at the end of a line: gone at once with undo. something booked, or holding tickets or a cost, asks once first
function RemoveLine({ stop: s, info }: { stop: Stop; info: LineInfo }) {
  const removeLater = useUndoRemove('stops')
  const [armed, setArmed] = useArmed()
  const title = stopTitle(s).toLowerCase()
  return (
    <button type="button" className={`icon-btn line-remove${armed ? ' armed' : ''}`} aria-label={`remove ${title}`} title="remove"
      onClick={() => { if (careful(s, info) && !armed) setArmed(true); else { setArmed(false); removeLater(s.id, title) } }}>
      {armed ? 'remove?' : <Icon name="close" size={16} />}
    </button>
  )
}
export const careful = (s: Stop, info: LineInfo) => s.status === 'booked' || info.tickets > 0 || !!info.cost

// one line of the doc: the time on the left, what it is on the right. the name opens its card, like a flight's;
// a place's or a note's time is live text you type over
export function ItinLine(props: Props) {
  const { entry, q } = props
  const canEdit = useCanEdit()
  const s = entry.stop!
  // a typed train or bus (no ends yet) is a line too; a journey with its stations keeps its times on its card
  const typed = s.kind === 'journey' && !s.origin && !s.destination
  const editable = canEdit && props.editing === true && entry.kind === 'stop' && (s.kind === 'place' || s.kind === 'note' || typed)
  // while searching, lines show their matches
  if (editable && !q) return <DocLine {...props} />
  return <StaticLine {...props} />
}

function StaticLine({ entry, any, q, current, day, onOpen, onLight, info = NO_INFO, seq }: Props) {
  const s = entry.stop!
  const canEdit = useCanEdit()
  const wide = useWide()
  const removeLater = useUndoRemove('stops')
  const removable = canEdit && entry.kind === 'stop'
  // on a phone a line swipes away (with undo); something booked or holding tickets or a cost goes from its card
  const swipe = useSwipeAway(() => removeLater(s.id, stopTitle(s).toLowerCase()), removable && !wide && !careful(s, info))
  const stay = entry.kind !== 'stop'
  const title = stay ? `${STAY[entry.kind]} · ${s.title}` : stopTitle(s)
  const sub = stay ? '' : subOf(s)
  const shows = entry.kind === 'stop' || entry.kind === 'checkin'
  // a search shows the line of the notes it found, unless that line is already under the name
  const found = snippet(s, q)
  const note = found && !(shows && found.trim() === info.note) ? found : null
  const when = timeOf(entry, any)
  const words = <>
    <span className="itin-title"><Marked text={title} q={q} /></span>
    {sub && <span className="itin-sub muted"><Sub text={sub} refCode={s.ref} q={q} /></span>}
    {shows && <InfoRow info={info} q={q} />}
    {note && <span className="itin-snippet muted"><Marked text={note} q={q} /></span>}
  </>
  return (
    <>
      <div className={`itin-line${stay ? ' quiet' : ''}${current ? ' current' : ''}`} data-line={s.id} data-testid="itin-line"
        onMouseEnter={() => onLight?.(s.id)} onMouseLeave={() => onLight?.(null)} {...(removable && !wide ? swipe : {})}>
        <span className="itin-time num" aria-label={when.till ? `${when.from} to ${when.till}` : undefined}>
          <span>{when.from}</span>{when.till && <span className="till">–{when.till}</span>}
        </span>
        <Marker stop={s} kind={entry.kind} seq={seq} />
        <button type="button" className="itin-main" onClick={() => onOpen?.(s, day)} disabled={!onOpen}
          onFocus={() => onLight?.(s.id)} onBlur={() => onLight?.(null)}>{words}</button>
        <span className="itin-end">
          {shows && <LineLinks info={info} />}
          {shows && <Pill status={s.status} kind={s.kind} />}
          {removable && wide && <RemoveLine stop={s} info={info} />}
        </span>
      </div>
      {entry.kind !== 'staying' && entry.kind !== 'checkout' && <SaveFailed table="stops" id={s.id} />}
    </>
  )
}

const valuesOf = (s: Stop): LineValues => ({ time: s.time ?? '', end: s.end_time ?? '', title: s.title })

// the next line's start time, or the day's empty line, so enter moves down the doc
function focusNext(from: HTMLElement | null) {
  const all = [...document.querySelectorAll<HTMLInputElement>('[data-doc-time], .add-line .line-name')]
  all[all.indexOf(from as HTMLInputElement) + 1]?.focus()
}

function DocLine({ entry, any, current, day, onOpen, onLight, info = NO_INFO, seq }: Props) {
  const s = entry.stop!
  const save = useSave('stops')
  const settle = useSettle()
  const [v, setV] = useState(() => valuesOf(s))
  const [problem, setProblem] = useState<string | null>(null)
  const [timeOpen, setTimeOpen] = useState(false)
  const [state, track] = useSaveNote()
  const box = useRef<HTMLDivElement>(null)
  const startRef = useRef<HTMLInputElement>(null)
  // what's on screen and what was last saved, read fresh from handlers that fire as focus moves
  const now = useRef(v)
  now.current = v
  const saved = useRef(valuesOf(s))
  const put = (x: LineValues) => { now.current = x; setV(x) }
  // someone else's change shows, unless you're typing on this line
  useEffect(() => {
    saved.current = valuesOf(s)
    if (!box.current?.contains(document.activeElement)) put(valuesOf(s))
  }, [s.time, s.end_time, s.title]) // eslint-disable-line react-hooks/exhaustive-deps

  const title = stopTitle(s)
  // a typed train or ride has nothing to add under its name (its time is already in the time column)
  const sub = s.kind === 'journey' ? '' : stopSub(s)
  const when = timeOf(entry, any)
  const was = saved.current
  const dirty = v.time !== was.time || v.end !== was.end

  function commit(): boolean {
    const read = readLine({ ...now.current, title: s.title })
    if ('problem' in read) { setProblem(read.problem); return false }
    const line = read.line
    setProblem(null)
    const was = saved.current
    const changed: Record<string, string | null> = {}
    if (line.time !== was.time) changed.time = line.time || null
    if (line.end !== was.end) changed.end_time = line.end || null
    saved.current = line
    put(line)
    if (Object.keys(changed).length) {
      if ('time' in changed) settle({ ...s, ...changed } as Stop)
      track(save.mutateAsync({ id: s.id, ...changed })).catch(() => { /* "couldn't save" shows under the line, with retry */ })
    }
    return true
  }
  function key(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); if (commit()) focusNext(startRef.current) }
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
          <Tooltip text="activities with a time are ordered automatically"><input ref={startRef} type="text" data-doc-time="" className={`doc-time${when.from === 'any' ? '' : ' quiet'}`} aria-label={`start time of ${title}`} placeholder="any" value={v.time}
            inputMode="decimal" autoComplete="off" onChange={(e) => typeTime('time', e.target.value)} onBlur={() => tidy('time')} onKeyDown={key} /></Tooltip>
          {(v.end || timeOpen) && <input type="text" className="doc-time till" aria-label={`end time of ${title}`} placeholder="end" value={v.end}
            inputMode="decimal" autoComplete="off" onChange={(e) => typeTime('end', e.target.value)} onBlur={() => tidy('end')} onKeyDown={key} />}
        </span>
        <Marker stop={s} kind={entry.kind} seq={seq} />
        {/* the rest of the line opens its card, where the name is changed */}
        <button type="button" className="itin-main" onClick={() => onOpen?.(s, day)} disabled={!onOpen}>
          <span className="itin-title">{title}</span>
          {sub && <span className="itin-sub muted">{sub}</span>}
          <InfoRow info={info} q="" />
          {problem && <span className="warn-line">{problem}</span>}
        </button>
        <span className="itin-end">
        <LineLinks info={info} />
        <Pill status={s.status} kind={s.kind} />
        <RemoveLine stop={s} info={info} />
        {dirty
          ? <span className="line-words">
              <button type="button" className="line-word quiet" aria-label={`cancel ${title}`} onClick={() => { put(saved.current); setProblem(null); startRef.current?.blur() }}>cancel</button>
              <button type="button" className="line-word" aria-label={`save ${title}`} onClick={() => { if (commit()) startRef.current?.blur() }}>save</button>
            </span>
          : state === 'saving' ? <Pending label="saving" className="line-state" />
          : state === 'saved' ? <span className="line-state muted" role="status"><Icon name="check" size={15} />saved</span>
          : null}
        </span>
      </div>
      <SaveFailed table="stops" id={s.id} />
    </>
  )
}
