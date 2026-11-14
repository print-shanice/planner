import { useState, type ReactNode } from 'react'
import type { Bag, PackingItem, Trip } from '../../lib/types'
import { useMembers, usePacking, useSave } from '../../lib/queries'
import { useAuth } from '../../lib/auth'
import { isPacked, shows, tickFor, toggled } from '../../lib/packing'
import { useUndoRemove } from '../../lib/undo'
import { useCanEdit } from '../../lib/offline'
import { loadState } from '../../lib/load'
import { LoadState } from '../../components/States'
import { Icon } from '../../components/Icon'
import { SaveFailed } from '../../components/SaveFailed'
import { memberName } from '../../components/Avatar'
import { useSwipeAway } from '../../lib/swipe'

export const BAGS: Record<Bag, string> = { check: 'check-in', carry: 'carry-on', wear: 'wear' }
const BAG_KEYS = Object.keys(BAGS) as Bag[]

function Row({ p, packed, canEdit, onTick, onEdit, onRemove }: { p: PackingItem; packed: boolean; canEdit: boolean; onTick: () => void; onEdit: () => void; onRemove: () => void }) {
  // a swipe to the left removes it, with undo
  const swipe = useSwipeAway(onRemove, canEdit, 'left')
  return (
    <li className={packed ? 'packed' : ''} {...swipe}>
      <label className="pack-tick">
        <input type="checkbox" aria-label={p.text} checked={packed} disabled={!canEdit} onChange={onTick} />
        <span className="tick" aria-hidden="true" />
      </label>
      <button type="button" className="pack-name" aria-label={`edit ${p.text}`} disabled={!canEdit} onClick={onEdit}>{p.text}</button>
      {p.bag && <span className="pack-bag">[{BAGS[p.bag]}]</span>}
      <SaveFailed table="packing" id={p.id} />
    </li>
  )
}

// one row of text choices, the picked one in ink and underlined
function Choices<T extends string>({ label, value, options, onPick, disabled }: { label: string; value: T; options: [T, string][]; onPick: (v: T) => void; disabled?: boolean }) {
  return (
    <div className="pack-choices" role="group" aria-label={label}>
      {options.map(([v, words]) => (
        <button key={v} type="button" aria-pressed={value === v} disabled={disabled} onClick={() => onPick(v)}>{words}</button>
      ))}
    </div>
  )
}

type Props = { trip: Trip; dates?: string; weather?: string | null; copyTo?: Trip[] }

export function PackingTab({ trip, dates, weather, copyTo = [] }: Props) {
  const pq = usePacking()
  const load = loadState(pq)
  const { userId } = useAuth()
  // the people who can own things: members who have signed in, me first
  const members = (useMembers().data ?? []).filter((m) => m.user_id)
  const people = [...members.filter((m) => m.user_id === userId), ...members.filter((m) => m.user_id !== userId)]
  const ids = people.map((m) => m.user_id!)
  const me = ids.includes(userId ?? '') ? userId : null
  const listName = (id: string) => (id === me ? 'mine' : `${memberName(people.find((m) => m.user_id === id)!)}'s`)
  // whose list is open: always one person's when there are two or more of you (shared things are on every list)
  const [picked, setPicked] = useState<string | null>(null)
  const view = ids.length > 1 ? (picked && ids.includes(picked) ? picked : ids[0]) : null
  const [bag, setBag] = useState<Bag | null>(null)
  const all = (pq.data ?? []).filter((p) => p.trip_id === trip.id)
  const packed = (p: PackingItem) => isPacked(p, view, ids)
  const mine = all.filter((p) => shows(p, view))
  const items = (bag ? mine.filter((p) => p.bag === bag) : mine).sort((a, b) => a.position - b.position)
  const toPack = items.filter((p) => !packed(p)), done = items.filter(packed)
  const save = useSave('packing')
  const removeLater = useUndoRemove('packing')
  const canEdit = useCanEdit()
  const [text, setText] = useState('')
  const [editing, setEditing] = useState<{ id: string; text: string; owner: string | null; bag: Bag | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [copying, setCopying] = useState(false)
  const [copied, setCopied] = useState('')
  if (load.state !== 'ready') return <LoadState load={load} />

  async function submit() {
    const value = (editing?.text ?? text).trim()
    if (!canEdit || !value || busy) return
    const was = editing && all.find((p) => p.id === editing.id)
    // an edit sends only what changed
    const change = was ? {
      id: was.id,
      ...(value !== was.text ? { text: value } : {}),
      ...(editing.owner !== (was.owner ?? null) ? { owner: editing.owner } : {}),
      ...(editing.bag !== (was.bag ?? null) ? { bag: editing.bag } : {}),
    } : null
    if (change && Object.keys(change).length === 1) { setEditing(null); return }
    setBusy(true); setProblem('')
    try {
      // a new thing goes on the open list, and in the bag being looked at
      await save.mutateAsync(change ?? {
        trip_id: trip.id, text: value, owner: view, packed_by: [], position: Math.max(-1, ...all.map(p => p.position)) + 1, ...(bag ? { bag } : {}),
      })
      if (editing) setEditing(null)
      else setText('')
    } catch { setProblem("couldn't save") }
    finally { setBusy(false) }
  }

  // the open list onto another trip, unticked; what's already there isn't added twice
  async function copyInto(to: Trip) {
    const there = (pq.data ?? []).filter((p) => p.trip_id === to.id)
    const key = (p: PackingItem) => `${p.owner ?? ''}|${p.text.trim().toLowerCase()}`
    const have = new Set(there.map(key))
    const fresh = mine.filter((p) => !have.has(key(p))).sort((a, b) => a.position - b.position)
    let position = Math.max(-1, ...there.map((p) => p.position)) + 1
    setBusy(true); setProblem(''); setCopying(false)
    try {
      for (const p of fresh) await save.mutateAsync({ trip_id: to.id, text: p.text, owner: p.owner ?? null, packed_by: [], position: position++, ...(p.bag ? { bag: p.bag } : {}) })
      setCopied(`${fresh.length} copied to ${to.name.toLowerCase()}`)
    } catch { setProblem("couldn't copy") }
    finally { setBusy(false) }
  }

  const row = (p: PackingItem): ReactNode => editing?.id === p.id ? (
    <li key={p.id}>
      <form className="pack-edit" onSubmit={e => { e.preventDefault(); void submit() }}>
        <input className="input" aria-label="packing item" autoFocus value={editing.text} disabled={busy} onChange={e => setEditing({ ...editing, text: e.target.value })} />
        <Choices label="bag" value={editing.bag ?? ''} disabled={busy} onPick={(v) => setEditing({ ...editing, bag: v || null })}
          options={[...BAG_KEYS.map((k): [Bag, string] => [k, BAGS[k]]), ['', 'no bag']]} />
        {people.length > 1 && <Choices label="whose" value={editing.owner ?? ''} disabled={busy} onPick={(v) => setEditing({ ...editing, owner: v || null })}
          options={[...ids.map((id): [string, string] => [id, listName(id)]), ['', ids.length === 2 ? 'both' : 'everyone']]} />}
        <div className="row">
          <button type="button" className="btn ghost small" disabled={busy} onClick={() => { setEditing(null); removeLater(p.id) }}>remove</button>
          <span className="spacer" />
          <button type="button" className="btn ghost small" disabled={busy} onClick={() => setEditing(null)}>cancel</button>
          <button type="submit" className="btn primary small" disabled={busy || !editing.text.trim()}>save</button>
        </div>
      </form>
    </li>
  ) : (
    <Row key={p.id} p={p} packed={packed(p)} canEdit={canEdit}
      onTick={() => save.mutate({ id: p.id, packed_by: toggled(p, tickFor(p, view, me), ids) })}
      onEdit={() => setEditing({ id: p.id, text: p.text, owner: p.owner ?? null, bag: p.bag ?? null })} onRemove={() => removeLater(p.id)} />
  )

  return (
    <div className="packing stack">
      {(dates || weather || copyTo.length > 0) && <div className="pack-meta">
        <div className="pack-meta-top">
          <span className="mono-label">{dates}</span>
          {canEdit && mine.length > 0 && copyTo.length > 0 && (
            <button type="button" className="pack-link" aria-expanded={copying} disabled={busy} onClick={() => { setCopying(!copying); setCopied('') }}>copy this list to…</button>
          )}
        </div>
        {weather && <p className="pack-weather" aria-label="weather">{weather}</p>}
      </div>}
      {copying && <div className="pack-copy" role="group" aria-label="copy to">
        <span className="mono-label">copy to</span>
        <div className="pack-copy-to">{copyTo.map((t) => <button key={t.id} type="button" disabled={busy} onClick={() => void copyInto(t)}>{t.name.toLowerCase()}</button>)}</div>
      </div>}
      {copied && <p className="pack-status" role="status">{copied}</p>}
      {people.length > 1 && <div className="pack-tabs small" role="tablist" aria-label="whose list">
        {ids.map((id) => <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => { setPicked(id); setEditing(null) }}>{listName(id)}</button>)}
      </div>}
      {mine.length > 0 && <div className="pack-count">
        <div className="pack-count-row">
          <p className="head num">{done.length} of {items.length} packed</p>
          <Choices label="show bag" value={bag ?? ''} onPick={(v) => setBag(v || null)} options={[['', 'all'], ...BAG_KEYS.map((k): [Bag, string] => [k, BAGS[k]])]} />
        </div>
        <div className="pack-meter" aria-hidden="true"><span style={{ width: `${items.length ? Math.round((done.length / items.length) * 100) : 0}%` }} /></div>
      </div>}
      {problem && <p role="alert" className="warn-line">{problem}</p>}
      {(toPack.length > 0 || canEdit) && <ul className="list pack-list" aria-label="packing">
        {toPack.map(row)}
        {canEdit && !editing && <li className="pack-add">
          <form onSubmit={e => { e.preventDefault(); void submit() }}>
            <Icon name="plus" size={18} />
            <input aria-label="add to pack" placeholder="add to pack" value={text} disabled={busy} enterKeyHint="done" onChange={e => setText(e.target.value)} />
            <button type="submit" className="btn small pack-go" aria-label="add to pack" disabled={busy}>add</button>
          </form>
        </li>}
      </ul>}
      {done.length > 0 && <>
        <p className="mono-label pack-done-head">packed</p>
        <ul className="list pack-list" aria-label="packed">{done.map(row)}</ul>
      </>}
    </div>
  )
}
