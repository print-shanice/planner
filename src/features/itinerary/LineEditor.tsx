import { useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'
import { readTime } from '../../lib/time'

export type LineValues = { time: string; end: string; title: string }

type Props = {
  label: string
  initial?: LineValues
  // returns a problem to show, or null once it's taken
  onSubmit: (v: LineValues) => string | null
  onCancel?: () => void
  // editing an existing line saves when focus leaves it
  saveOnLeave?: boolean
  focus?: 'time' | 'title'
  className?: string
}

const EMPTY: LineValues = { time: '', end: '', title: '' }

// the line as typed, read: times as hh:mm (or empty), or the problem with it
export function readLine(v: LineValues): { line: LineValues } | { problem: string } {
  const time = readTime(v.time), end = readTime(v.end)
  if (time === undefined || end === undefined) return { problem: 'check the time' }
  if (end && (!time || end <= time)) return { problem: 'end before start' }
  return { line: { time: time ?? '', end: end ?? '', title: v.title } }
}

// a line of the doc you can type: the time column (start, end) and the name
export function LineEditor({ label, initial = EMPTY, onSubmit, onCancel, saveOnLeave, focus, className = '' }: Props) {
  const [v, setV] = useState(initial)
  const [problem, setProblem] = useState<string | null>(null)
  const start = useRef<HTMLInputElement>(null)
  // once saved or cancelled, the blur that follows doesn't save again
  const closed = useRef(false)
  const set = (p: Partial<LineValues>) => { setV((x) => ({ ...x, ...p })); setProblem(null) }

  function submit() {
    const read = readLine(v)
    const p = 'problem' in read ? read.problem : onSubmit(read.line)
    setProblem(p)
    if (p) return
    if (saveOnLeave) { closed.current = true; return }
    setV(EMPTY)
    start.current?.focus()
  }
  function key(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); submit() }
    if (e.key === 'Escape' && onCancel) { e.preventDefault(); closed.current = true; onCancel() }
  }
  function leave(e: FocusEvent<HTMLDivElement>) {
    if (!saveOnLeave || closed.current || e.currentTarget.contains(e.relatedTarget as Node | null)) return
    closed.current = true
    const read = readLine(v)
    if ('problem' in read || onSubmit(read.line)) onCancel?.()
  }

  return (
    <div className={`line-edit ${className}`} role="group" aria-label={label} onBlur={leave}>
      <span className="line-times">
        {/* typed like the doc's time column: "9", "13:00", "1pm"; empty is any time */}
        <input ref={start} type="text" aria-label="start time" placeholder="any" value={v.time} autoComplete="off"
          onChange={(e) => set({ time: e.target.value })} onKeyDown={key} autoFocus={focus === 'time'} />
        {/* an end only once there's a start */}
        {(v.time || v.end) && <input type="text" aria-label="end time" placeholder="end" value={v.end} autoComplete="off"
          onChange={(e) => set({ end: e.target.value })} onKeyDown={key} />}
      </span>
      <input type="text" className="line-name" aria-label={label} placeholder="name" value={v.title} autoComplete="off" enterKeyHint="done"
        onChange={(e) => set({ title: e.target.value })} onKeyDown={key} autoFocus={focus === 'title'} />
      <button type="button" className="btn small line-go" aria-label={saveOnLeave ? 'save line' : 'add line'} onClick={submit}>
        {saveOnLeave ? 'save' : 'add'}
      </button>
      {problem && <p className="warn-line line-problem">{problem}</p>}
    </div>
  )
}
