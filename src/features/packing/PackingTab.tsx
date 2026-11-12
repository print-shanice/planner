import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import type { Member, PackingItem, Trip } from '../../lib/types'
import { useMembers, usePacking, useSave } from '../../lib/queries'
import { useAuth } from '../../lib/auth'
import { colourVar } from '../../lib/colors'
import { isPacked, packedBy, shows, tickFor, toggled } from '../../lib/packing'
import { useUndoRemove } from '../../lib/undo'
import { useCanEdit } from '../../lib/offline'
import { loadState } from '../../lib/load'
import { LoadState } from '../../components/States'
import { Icon } from '../../components/Icon'
import { SaveFailed } from '../../components/SaveFailed'

// a swipe further left than this removes the item (with undo)
const SWIPE = 80

const who = (m: Member) => (m.name || m.email).toLowerCase()
const Face = ({ m, ticked }: { m: Member; ticked?: boolean }) => (
  <span className="avatar" style={{ background: colourVar(m.color) }}>{who(m).slice(0, 1)}{ticked && <span className="pack-face-tick"><Icon name="check" size={10} /></span>}</span>
)

// whose a thing is, as faces: its owner's, or everyone's overlapping for a shared thing (a ✓ on whoever has packed it)
function Whose({ p, people, view }: { p: PackingItem; people: Member[]; view: string | null }) {
  if (people.length < 2) return null
  const owner = people.find((m) => m.user_id === p.owner)
  const by = packedBy(p, people.map((m) => m.user_id!))
  const shared = !owner
  const partly = shared && !view && by.length > 0 && by.length < people.length
  const faces = owner ? [owner] : people
  const said = owner ? who(owner) : [people.length === 2 ? 'both' : 'everyone', ...(partly ? [`${people.filter((m) => by.includes(m.user_id!)).map(who).join(' and ')} packed`] : [])].join(' · ')
  return (
    <span className="pack-who">
      <span className="pack-faces-row" aria-hidden="true">{faces.map((m) => <Face key={m.user_id} m={m} ticked={partly && by.includes(m.user_id!)} />)}</span>
      <span className="sr-only">{said}</span>
    </span>
  )
}

function Row({ p, packed, whose, canEdit, onTick, onEdit, onRemove }: { p: PackingItem; packed: boolean; whose: ReactNode; canEdit: boolean; onTick: () => void; onEdit: () => void; onRemove: () => void }) {
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
    <li className={packed ? 'packed' : ''} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { start.current = null; setDx(0) }}
      style={dx ? { transform: `translateX(${dx}px)` } : undefined}>
      <label className="pack-tick">
        <input type="checkbox" aria-label={p.text} checked={packed} disabled={!canEdit} onChange={onTick} />
        <span className="tick" aria-hidden="true">{packed && <Icon name="check" size={16} />}</span>
      </label>
      <button type="button" className="pack-name" aria-label={`edit ${p.text}`} disabled={!canEdit} onClick={onEdit}>{p.text}</button>
      {whose}
      <SaveFailed table="packing" id={p.id} />
    </li>
  )
}

export function PackingTab({ trip }: { trip: Trip }) {
  const pq = usePacking()
  const load = loadState(pq)
  const { userId } = useAuth()
  // the people who can own things: members who have signed in
  const people = (useMembers().data ?? []).filter((m) => m.user_id)
  const ids = people.map((m) => m.user_id!)
  const me = ids.includes(userId ?? '') ? userId : null
  // the face picked at the top; it always opens on everything
  const [picked, setPicked] = useState<string | null>(null)
  const view = ids.length > 1 && picked && ids.includes(picked) ? picked : null
  const all = (pq.data ?? []).filter((p) => p.trip_id === trip.id)
  const packed = (p: PackingItem) => isPacked(p, view, ids)
  // what's left to pack on top; packed things sink
  const items = all.filter((p) => shows(p, view)).sort((a, b) => Number(packed(a)) - Number(packed(b)) || a.position - b.position)
  const save = useSave('packing')
  const removeLater = useUndoRemove('packing')
  const canEdit = useCanEdit()
  const [text, setText] = useState('')
  const [editing, setEditing] = useState<{ id: string; text: string; owner: string | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  if (load.state !== 'ready') return <LoadState load={load} blocks={1} />
  const done = items.filter(packed).length

  async function submit() {
    const value = (editing?.text ?? text).trim()
    if (!canEdit || !value || busy) return
    const was = editing && all.find((p) => p.id === editing.id)
    // an edit sends only what changed
    const change = was ? {
      id: was.id,
      ...(value !== was.text ? { text: value } : {}),
      ...(editing.owner !== (was.owner ?? null) ? { owner: editing.owner } : {}),
    } : null
    if (change && Object.keys(change).length === 1) { setEditing(null); return }
    setBusy(true); setProblem('')
    try {
      await save.mutateAsync(change ?? {
        trip_id: trip.id, text: value, owner: view, packed_by: [], position: Math.max(-1, ...all.map(p => p.position)) + 1,
      })
      if (editing) setEditing(null)
      else setText('')
    } catch { setProblem("couldn't save") }
    finally { setBusy(false) }
  }

  const choose = (owner: string | null, m: Member | null) => editing && (
    <button key={owner ?? 'both'} type="button" className="face" aria-label={`for ${m ? who(m) : ids.length === 2 ? 'both' : 'everyone'}`} aria-pressed={editing.owner === owner}
      disabled={busy} onClick={() => setEditing({ ...editing, owner })} style={{ '--c': m ? colourVar(m.color) : 'var(--ink-3)' } as CSSProperties}>
      {m ? <Face m={m} /> : <span className="pack-faces-row">{people.map((x) => <Face key={x.user_id} m={x} />)}</span>}
    </button>
  )

  return (
    <div className="packing stack">
      <LoadState load={load} />
      {people.length > 1 && <div className="faces pack-pick" role="group" aria-label="whose things">
        {people.map((m) => (
          <button key={m.user_id} type="button" className="face" aria-label={who(m)} aria-pressed={view === m.user_id}
            onClick={() => setPicked(view === m.user_id ? null : m.user_id)} style={{ '--c': colourVar(m.color) } as CSSProperties}>
            <Face m={m} /><span aria-hidden="true">{who(m)}</span>
          </button>
        ))}
      </div>}
      {items.length > 0 && <div className="pack-count">
        <p className="head num">{done} of {items.length} packed</p>
        <div className="pack-meter" aria-hidden="true"><span style={{ width: `${Math.round((done / items.length) * 100)}%` }} /></div>
      </div>}
      {problem && <p role="alert" className="warn-line">{problem}</p>}
      {(items.length > 0 || canEdit) && <ul className="list pack-list" aria-label="packing">
        {items.map((p) => editing?.id === p.id ? (
          <li key={p.id}>
            <form className="pack-edit" onSubmit={e => { e.preventDefault(); void submit() }}>
              <input className="input" aria-label="packing item" autoFocus value={editing.text} disabled={busy} onChange={e => setEditing({ ...editing, text: e.target.value })} />
              {people.length > 1 && <div className="faces pack-whose" role="group" aria-label="whose">
                {people.map((m) => choose(m.user_id, m))}{choose(null, null)}
              </div>}
              <div className="row">
                <button type="button" className="btn ghost small" disabled={busy} onClick={() => { setEditing(null); removeLater(p.id) }}>remove</button>
                <span className="spacer" />
                <button type="button" className="btn ghost small" disabled={busy} onClick={() => setEditing(null)}>cancel</button>
                <button type="submit" className="btn primary small" disabled={busy || !editing.text.trim()}>save</button>
              </div>
            </form>
          </li>
        ) : (
          <Row key={p.id} p={p} packed={packed(p)} whose={<Whose p={p} people={people} view={view} />} canEdit={canEdit}
            onTick={() => save.mutate({ id: p.id, packed_by: toggled(p, tickFor(p, view, me), ids) })}
            onEdit={() => setEditing({ id: p.id, text: p.text, owner: p.owner ?? null })} onRemove={() => removeLater(p.id)} />
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
