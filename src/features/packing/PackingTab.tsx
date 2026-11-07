import { useState } from 'react'
import type { Trip } from '../../lib/types'
import { usePacking, useRemove, useSave } from '../../lib/queries'
import { useUndoRemove } from '../../lib/undo'
import { useCanEdit } from '../../lib/offline'
import { loadState } from '../../lib/load'
import { LoadState } from '../../components/States'
import { Icon } from '../../components/Icon'
import { SaveFailed } from '../../components/SaveFailed'
import { TwoTapDelete } from '../../components/TwoTapDelete'

export function PackingTab({ trip }: { trip: Trip }) {
  const pq = usePacking()
  const load = loadState(pq)
  const items = (pq.data ?? []).filter((p) => p.trip_id === trip.id).sort((a, b) => a.position - b.position)
  const save = useSave('packing')
  const remove = useRemove('packing')
  const removeLater = useUndoRemove('packing')
  const canEdit = useCanEdit()
  const [text, setText] = useState('')
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  if (load.state !== 'ready') return <LoadState load={load} blocks={1} />
  const done = items.filter((p) => p.done).length
  const selected = items.filter(p => picked.has(p.id))

  async function submit() {
    const value = (editing?.text ?? text).trim()
    if (!canEdit || !value || busy) return
    setBusy(true); setProblem('')
    try {
      await save.mutateAsync(editing ? { id: editing.id, text: value } : {
        trip_id: trip.id, text: value, done: false, position: Math.max(-1, ...items.map(p => p.position)) + 1,
      })
      if (editing) setEditing(null)
      else setText('')
    } catch { setProblem("couldn't save") }
    finally { setBusy(false) }
  }

  async function removePicked() {
    if (!canEdit || busy) return
    setBusy(true); setProblem('')
    const results = await Promise.allSettled(selected.map(p => remove.mutateAsync(p.id)))
    const failed = selected.filter((_, i) => results[i].status === 'rejected')
    setPicked(new Set(failed.map(p => p.id)))
    setSelecting(failed.length > 0)
    if (failed.length) setProblem("couldn't remove")
    setBusy(false)
  }

  return (
    <div className="packing stack">
      <LoadState load={load} />
      {items.length > 0 && <div className="packing-tools">
        <p className="muted num">{done} of {items.length} packed</p>
        {canEdit && <button type="button" className="btn ghost" disabled={busy} onClick={() => { setSelecting(!selecting); setPicked(new Set()); setEditing(null) }}>{selecting ? 'done' : 'select'}</button>}
      </div>}
      {selecting && <div className="pick-bar">
        <button type="button" className="btn ghost" disabled={busy} onClick={() => setPicked(new Set(items.map(p => p.id)))}>select all</button>
        <span className="muted num">{selected.length} selected</span>
        <TwoTapDelete label={`delete ${selected.length}`} disabled={!selected.length || busy} onConfirm={removePicked} />
      </div>}
      {problem && <p role="alert" className="warn-line">{problem}</p>}
      {items.length > 0 && <ul className="list pack-list">
        {items.map((p) => <li key={p.id} className={p.done ? 'packed' : ''}>
          {selecting ? <label className="pack-item">
            <input type="checkbox" className="pick" aria-label={p.text} checked={picked.has(p.id)} disabled={busy}
              onChange={() => setPicked(previous => { const next = new Set(previous); if (next.has(p.id)) next.delete(p.id); else next.add(p.id); return next })} />
            <span>{p.text}</span>
          </label> : editing?.id === p.id ? <form className="pack-edit" onSubmit={e => { e.preventDefault(); void submit() }}>
            <input className="input" aria-label="packing item" autoFocus value={editing.text} disabled={busy} onChange={e => setEditing({ id: p.id, text: e.target.value })} />
            <button type="submit" className="btn ghost" disabled={busy || !editing.text.trim()}>save</button>
            <button type="button" className="btn ghost" disabled={busy} onClick={() => setEditing(null)}>cancel</button>
          </form> : <>
            <button type="button" className="pack-item" aria-pressed={p.done} disabled={!canEdit} onClick={() => save.mutate({ id: p.id, done: !p.done })}>
              <span className="tick" aria-hidden="true">{p.done && <Icon name="check" size={16} />}</span><span>{p.text}</span>
            </button>
            {canEdit && <>
              <button type="button" className="icon-btn" aria-label={`edit ${p.text}`} onClick={() => setEditing({ id: p.id, text: p.text })}><Icon name="edit" size={18} /></button>
              <button type="button" className="icon-btn" aria-label={`remove ${p.text}`} onClick={() => removeLater(p.id)}><Icon name="close" size={18} /></button>
            </>}
          </>}
          <SaveFailed table="packing" id={p.id} />
        </li>)}
      </ul>}
      {canEdit && !selecting && !editing && <form className="pack-add-row" onSubmit={e => { e.preventDefault(); void submit() }}>
        <input className="input" aria-label="add to pack" placeholder="add to pack" value={text} disabled={busy} enterKeyHint="done" onChange={e => setText(e.target.value)} />
        <button type="submit" className="btn ghost" disabled={busy || !text.trim()}>add item</button>
      </form>}
    </div>
  )
}
