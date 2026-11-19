import { useState, type FormEvent } from 'react'
import { useSave } from '../../lib/queries'
import { spanWords } from '../../lib/daysOff'
import { dayLabel } from '../../lib/dates'

// under the month while marking: the picked days in words, which kind they are (a holiday, or days you can't travel),
// then a name for them. adding saves them as one row
export function MarkLine({ from, to, onDone }: { from: string; to: string; onDone: () => void }) {
  const save = useSave('days_off')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  function add(e: FormEvent) {
    e.preventDefault()
    const text = name.trim()
    if (!text) return
    save.mutateAsync({ name: text, start_date: from, end_date: to, busy }).catch(() => { /* comes back out; the month shows it isn't saved */ })
    onDone()
  }

  return (
    <div className="mark-line">
      <p className="mark-line-top mono">
        <span>{spanWords(from, to)}</span>
        <button type="button" className="icon-btn mark-stop" aria-label="stop marking" onClick={onDone}>✕</button>
      </p>
      <OffKind busy={busy} onPick={setBusy} />
      <form className="jot" onSubmit={add}>
        <input type="text" aria-label="name these days" placeholder="name these days…" value={name} autoComplete="off" autoFocus enterKeyHint="done"
          onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') onDone() }} />
        <button type="submit" className="btn small line-go" aria-label={busy ? "add days you can't travel" : 'add holiday'} disabled={!name.trim()}>add</button>
      </form>
    </div>
  )
}

// while marking, before both ends are picked: what to tap next, so the underlined word never leaves you guessing
export function MarkPrompt({ first, onDone }: { first: string | null; onDone: () => void }) {
  return (
    <div className="mark-line">
      <p className="mark-line-top mono" role="status">
        <span>{first ? `${dayLabel(first)} · tap the last day` : 'tap the first day'}</span>
        <button type="button" className="icon-btn mark-stop" aria-label="stop marking" onClick={onDone}>✕</button>
      </p>
    </div>
  )
}

// a holiday, or days you can't travel: plain words, the picked one ink and bold
export function OffKind({ busy, onPick }: { busy: boolean; onPick: (busy: boolean) => void }) {
  return (
    <div className="segmented mark-kind" role="group" aria-label="which">
      <button type="button" aria-pressed={!busy} onClick={() => onPick(false)}>holiday</button>
      <button type="button" aria-pressed={busy} onClick={() => onPick(true)}>can't travel</button>
    </div>
  )
}
