import { useState } from 'react'
import type { Trip } from '../../lib/types'
import { usePacking, useRemove, useSave } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { Icon } from '../../components/Icon'

export function PackingTab({ trip }: { trip: Trip }) {
  const items = (usePacking().data ?? []).filter((p) => p.trip_id === trip.id).sort((a, b) => a.position - b.position)
  const save = useSave('packing')
  const remove = useRemove('packing')
  const canEdit = useCanEdit()
  const [text, setText] = useState('')
  const done = items.filter((p) => p.done).length

  function add() {
    const t = text.trim()
    if (!t) return
    const position = items.length ? Math.max(...items.map((p) => p.position)) + 1 : 0
    save.mutate({ trip_id: trip.id, text: t, done: false, position })
    setText('')
  }

  return (
    <div className="packing stack">
      {items.length > 0 && <p className="muted num">{done} of {items.length} packed</p>}
      {items.length > 0 && (
        <ul className="list pack-list">
          {items.map((p) => (
            <li key={p.id} className={p.done ? 'packed' : ''}>
              <button type="button" className="pack-item" aria-pressed={p.done} disabled={!canEdit} onClick={() => save.mutate({ id: p.id, done: !p.done })}>
                <span className="tick" aria-hidden="true">{p.done && <Icon name="check" size={16} />}</span>
                <span>{p.text}</span>
              </button>
              {canEdit && <button type="button" className="icon-btn" aria-label={`remove ${p.text}`} onClick={() => remove.mutate(p.id)}><Icon name="close" size={18} /></button>}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="search-box pack-add">
          <Icon name="plus" size={18} />
          <input aria-label="add to pack" placeholder="add to pack" value={text} enterKeyHint="done" onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} />
        </div>
      )}
    </div>
  )
}
