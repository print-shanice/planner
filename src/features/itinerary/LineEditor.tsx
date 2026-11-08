import { useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'

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

export function lineProblem(v: LineValues): string | null {
  if (v.end && (!v.time || v.end <= v.time)) return 'end before start'
  return null
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
    const p = lineProblem(v) ?? onSubmit(v)
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
    if (lineProblem(v) || onSubmit(v)) onCancel?.()
  }

  return (
    <div className={`line-edit ${className}`} role="group" aria-label={label} onBlur={leave}>
      <span className="line-times">
        <input ref={start} type="time" aria-label="start time" value={v.time} data-empty={v.time ? undefined : ''}
          onChange={(e) => set({ time: e.target.value })} onKeyDown={key} autoFocus={focus === 'time'} />
        {/* an end only once there's a start */}
        {(v.time || v.end) && <input type="time" aria-label="end time" value={v.end} data-empty={v.end ? undefined : ''}
          onChange={(e) => set({ end: e.target.value })} onKeyDown={key} />}
      </span>
      <input type="text" className="line-name" aria-label={label} placeholder="add" value={v.title} autoComplete="off" enterKeyHint="done"
        onChange={(e) => set({ title: e.target.value })} onKeyDown={key} autoFocus={focus === 'title'} />
      {problem && <p className="warn-line line-problem">{problem}</p>}
    </div>
  )
}
