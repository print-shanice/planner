import { useState, type FormEvent } from 'react'
import { useSave } from '../../lib/queries'
import { spanWords } from '../../lib/daysOff'

// under the month while marking: the picked days in words, then a name for them. adding saves them as one holiday
export function MarkLine({ from, to, onDone }: { from: string; to: string; onDone: () => void }) {
  const save = useSave('days_off')
  const [name, setName] = useState('')

  function add(e: FormEvent) {
    e.preventDefault()
    const text = name.trim()
    if (!text) return
    save.mutateAsync({ name: text, start_date: from, end_date: to }).catch(() => { /* comes back out; the month shows it isn't saved */ })
    onDone()
  }

  return (
    <div className="mark-line">
      <p className="mark-line-top mono">
        <span>{spanWords(from, to)}</span>
        <button type="button" className="icon-btn mark-stop" aria-label="stop marking" onClick={onDone}>✕</button>
      </p>
      <form className="jot" onSubmit={add}>
        <input type="text" aria-label="name these days" placeholder="name these days…" value={name} autoComplete="off" autoFocus enterKeyHint="done"
          onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') onDone() }} />
        <button type="submit" className="btn small line-go" aria-label="add holiday" disabled={!name.trim()}>add</button>
      </form>
    </div>
  )
}
