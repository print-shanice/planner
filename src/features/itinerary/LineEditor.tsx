import { useRef, useState, type KeyboardEvent } from 'react'
import { couldBeTime, readTime } from '../../lib/time'

export type LineValues = { time: string; end: string; title: string }

type Props = {
  label: string
  onSubmit: (v: LineValues) => void
}

const EMPTY: LineValues = { time: '', end: '', title: '' }

// the line as typed, read: times as hh:mm (or empty), or the problem with it
export function readLine(v: LineValues): { line: LineValues } | { problem: string } {
  const time = readTime(v.time), end = readTime(v.end)
  if (time === undefined || end === undefined) return { problem: 'check the time' }
  if (end && (!time || end <= time)) return { problem: 'end before start' }
  return { line: { time: time ?? '', end: end ?? '', title: v.title } }
}

// a new line of the doc you type: the time column (start, end) and the name; it empties once added
export function LineEditor({ label, onSubmit }: Props) {
  const [v, setV] = useState(EMPTY)
  const [problem, setProblem] = useState<string | null>(null)
  const start = useRef<HTMLInputElement>(null)
  const set = (p: Partial<LineValues>) => { setV((x) => ({ ...x, ...p })); setProblem(null) }
  // a time box takes only what could become a time, and tidies it to 13:00 when you leave it
  const typeTime = (k: 'time' | 'end', x: string) => { if (couldBeTime(x)) set({ [k]: x }) }
  const tidy = (k: 'time' | 'end') => { const t = readTime(v[k]); if (t) setV((x) => ({ ...x, [k]: t })) }

  function submit() {
    const read = readLine(v)
    if ('problem' in read) { setProblem(read.problem); return }
    onSubmit(read.line)
    setV(EMPTY)
    start.current?.focus()
  }
  function key(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); submit() }
  }

  return (
    <div className="line-edit" role="group" aria-label={label}>
      <span className="line-times">
        {/* typed like the doc's time column: "9", "13:00", "1pm"; empty is any time */}
        <input ref={start} type="text" aria-label="start time" placeholder="any" value={v.time} autoComplete="off"
          inputMode="decimal"
          onChange={(e) => typeTime('time', e.target.value)} onBlur={() => tidy('time')} onKeyDown={key} />
        {/* an end only once there's a start */}
        {(v.time || v.end) && <input type="text" aria-label="end time" placeholder="end" value={v.end} autoComplete="off"
          inputMode="decimal"
          onChange={(e) => typeTime('end', e.target.value)} onBlur={() => tidy('end')} onKeyDown={key} />}
      </span>
      <input type="text" className="line-name" aria-label={label} placeholder="name" value={v.title} autoComplete="off" enterKeyHint="done"
        onChange={(e) => set({ title: e.target.value })} onKeyDown={key} />
      <button type="button" className="btn small line-go" aria-label="add line" onClick={submit}>add</button>
      {problem && <p className="warn-line line-problem">{problem}</p>}
    </div>
  )
}
