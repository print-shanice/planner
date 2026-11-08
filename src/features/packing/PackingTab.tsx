import { useRef, useState, type PointerEvent } from 'react'
import type { PackingItem, Trip } from '../../lib/types'
import { usePacking, useSave } from '../../lib/queries'
import { useUndoRemove } from '../../lib/undo'
import { useCanEdit } from '../../lib/offline'
import { loadState } from '../../lib/load'
import { LoadState } from '../../components/States'
import { Icon } from '../../components/Icon'
import { SaveFailed } from '../../components/SaveFailed'

// a swipe further left than this removes the item (with undo)
const SWIPE = 80

function Row({ p, canEdit, onTick, onEdit, onRemove }: { p: PackingItem; canEdit: boolean; onTick: () => void; onEdit: () => void; onRemove: () => void }) {
  const start = useRef<number | null>(null)
  const [dx, setDx] = useState(0)
  const down = (e: PointerEvent<HTMLLIElement>) => { if (canEdit) start.current = e.clientX }
  const move = (e: PointerEvent<HTMLLIElement>) => { if (start.current != null) setDx(Math.min(0, e.clientX - start.current)) }
  const up = (e: PointerEvent<HTMLLIElement>) => {
    if (start.current == null) return
    const far = e.clientX - start.current < -SWIPE
    start.current = null
    setDx(0)
    if (far) onRemove()
  }
  return (
    <li className={p.done ? 'packed' : ''} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { start.current = null; setDx(0) }}
      style={dx ? { transform: `translateX(${dx}px)` } : undefined}>
      <label className="pack-tick">
        <input type="checkbox" aria-label={p.text} checked={p.done} disabled={!canEdit} onChange={onTick} />
        <span className="tick" aria-hidden="true">{p.done && <Icon name="check" size={16} />}</span>
      </label>
      <button type="button" className="pack-name" aria-label={`edit ${p.text}`} disabled={!canEdit} onClick={onEdit}>{p.text}</button>
      <SaveFailed table="packing" id={p.id} />
    </li>
  )
}

export function PackingTab({ trip }: { trip: Trip }) {
  const pq = usePacking()
  const load = loadState(pq)
  const mine = (pq.data ?? []).filter((p) => p.trip_id === trip.id)
  // what's left to pack on top; packed things sink
  const items = [...mine].sort((a, b) => Number(a.done) - Number(b.done) || a.position - b.position)
  const save = useSave('packing')
  const removeLater = useUndoRemove('packing')
  const canEdit = useCanEdit()
  const [text, setText] = useState('')
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  if (load.state !== 'ready') return <LoadState load={load} blocks={1} />
  const done = items.filter((p) => p.done).length

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

  return (
    <div className="packing stack">
      <LoadState load={load} />
      {items.length > 0 && <div className="pack-count">
        <p className="head num">{done} of {items.length} packed</p>
        <div className="pack-meter" aria-hidden="true"><span style={{ width: `${Math.round((done / items.length) * 100)}%` }} /></div>
      </div>}
      {problem && <p role="alert" className="warn-line">{problem}</p>}
      {(items.length > 0 || canEdit) && <ul className="list pack-list" aria-label="packing">
        {items.map((p) => editing?.id === p.id ? (
          <li key={p.id}>
            <form className="pack-edit" onSubmit={e => { e.preventDefault(); void submit() }}>
              <input className="input" aria-label="packing item" autoFocus value={editing.text} disabled={busy} onChange={e => setEditing({ id: p.id, text: e.target.value })} />
              <div className="row">
                <button type="button" className="btn ghost small" disabled={busy} onClick={() => { setEditing(null); removeLater(p.id) }}>remove</button>
                <span className="spacer" />
                <button type="button" className="btn ghost small" disabled={busy} onClick={() => setEditing(null)}>cancel</button>
                <button type="submit" className="btn primary small" disabled={busy || !editing.text.trim()}>save</button>
              </div>
            </form>
          </li>
        ) : (
          <Row key={p.id} p={p} canEdit={canEdit} onTick={() => save.mutate({ id: p.id, done: !p.done })}
            onEdit={() => setEditing({ id: p.id, text: p.text })} onRemove={() => removeLater(p.id)} />
        ))}
        {canEdit && !editing && <li className="pack-add">
          <form onSubmit={e => { e.preventDefault(); void submit() }}>
            <Icon name="plus" size={18} />
            <input aria-label="add to pack" placeholder="add to pack" value={text} disabled={busy} enterKeyHint="done" onChange={e => setText(e.target.value)} />
            <button type="submit" className="btn small pack-go" aria-label="add to pack" disabled={busy}>add</button>
          </form>
        </li>}
      </ul>}
    </div>
  )
}
