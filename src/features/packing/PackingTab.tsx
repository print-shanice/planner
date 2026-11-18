import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Bag, PackingItem, Trip } from '../../lib/types'
import { useMembers, usePacking, useSave } from '../../lib/queries'
import { useAuth } from '../../lib/auth'
import { arrange, bagOf, isPacked, packBags, parseQty, qtyLabel, qtyOf, shows, tally, tickFor, toggled, type PackGroup } from '../../lib/packing'
import { newId } from '../../lib/id'
import { Pack } from './Pack'
import { useUndoRemove } from '../../lib/undo'
import { useCanEdit } from '../../lib/offline'
import { loadState } from '../../lib/load'
import { LoadState } from '../../components/States'
import { SaveFailed } from '../../components/SaveFailed'
import { ChoiceMenu } from '../../components/ChoiceMenu'
import { memberName } from '../../components/Avatar'
import { useSwipeAway } from '../../lib/swipe'

export const BAGS: Record<Bag, string> = { check: 'check-in', carry: 'carry-on', wear: 'wear' }
const BAG_KEYS = Object.keys(BAGS) as Bag[]

function Row({ p, packed, canEdit, bag, onTick, onEdit, onRemove }: { p: PackingItem; packed: boolean; canEdit: boolean; bag: Bag | null; onTick: () => void; onEdit: () => void; onRemove: () => void }) {
  // a swipe to the left removes it, with undo
  const swipe = useSwipeAway(onRemove, canEdit, 'left')
  const qty = qtyLabel(p)
  return (
    <li className={packed ? 'packed' : ''} {...swipe}>
      <label className="pack-tick">
        <input type="checkbox" aria-label={p.text} checked={packed} disabled={!canEdit} onChange={onTick} />
        <span className="tick" aria-hidden="true" />
      </label>
      <span className="pack-name">{p.text}{qty && <span className="pack-qty num">{qty}</span>}</span>
      {/* every thing has its own "edit" just after its name, like a pack (only "edit" opens it); the bag stays alone on the right */}
      {canEdit && <button type="button" className="pack-edit-link pack-row-edit" aria-label={`edit ${p.text}`} onClick={onEdit}>edit</button>}
      {bag && <span className="pack-bag">{BAGS[bag]}</span>}
      <SaveFailed table="packing" id={p.id} />
    </li>
  )
}

// one row of text choices, the picked one in ink and underlined
function Choices<T extends string>({ label, value, options, onPick, disabled, named }: { label: string; value: T; options: [T, string][]; onPick: (v: T) => void; disabled?: boolean; named?: boolean }) {
  const words = options.map(([v, w]) => (
    <button key={v} type="button" aria-pressed={value === v} disabled={disabled} onClick={() => onPick(v)}>{w}</button>
  ))
  // named: the row says what it's for ("in", "bag", "whose"), its words lined up beside it
  return (
    <div className="pack-choices" role="group" aria-label={label}>
      {named ? <><span className="pack-choices-k" aria-hidden="true">{label}</span><span className="pack-choices-words">{words}</span></> : words}
    </div>
  )
}

type Props = { trip: Trip; dates?: string; weather?: string | null; copyTo?: Trip[] }
type Editing = { id: string; text: string; owner: string | null; bag: Bag | null; parent: string | null; isPack: boolean }

// "3 black tees" in the edit field for a thing with three
const typedWithQty = (p: PackingItem) => (qtyOf(p) > 1 ? `${qtyOf(p)} ${p.text}` : p.text)

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
  // one bag at a time, or all of them; the count follows it. a thing inside a pack goes in its own bag, else its pack's
  const [bag, setBag] = useState<Bag | null>(null)
  const all = (pq.data ?? []).filter((p) => p.trip_id === trip.id)
  const byId = new Map(all.map((p) => [p.id, p]))
  const packed = (p: PackingItem) => isPacked(p, view, ids)
  // a thing in a pack is on whichever lists its pack is on
  const mine = all.filter((p) => { const pack = p.parent_id ? byId.get(p.parent_id) : null; return pack ? shows(pack, view) : shows(p, view) })
  // with a bag picked: the things in it, and the packs holding any of them (or, empty, in it themselves)
  const inBag = (p: PackingItem) => !bag || bagOf(p, byId) === bag
  const { packs, loose } = arrange(!bag ? mine : mine.filter((p) => p.is_pack
    ? (mine.some((t) => t.parent_id === p.id) ? mine.some((t) => t.parent_id === p.id && inBag(t)) : inBag(p))
    : inBag(p)))
  const things = [...loose, ...packs.flatMap((g) => g.things)]
  const count = tally(things, packed)
  const packDone = (g: PackGroup) => g.things.length > 0 && g.things.every(packed)
  const allPacks = arrange(mine).packs.map((g) => g.pack)
  const save = useSave('packing')
  const removeLater = useUndoRemove('packing')
  const canEdit = useCanEdit()
  const [text, setText] = useState('')
  // the bag new things go in, picked from the dropdown on the add line: stays picked so a run of carry-on things is quick
  const [addBag, setAddBag] = useState<Bag | ''>('')
  const addField = useRef<HTMLInputElement>(null)
  // one pack open at a time, with its own add line; a pack just made opens with the cursor in that line
  const [open, setOpen] = useState<string | null>(null)
  const [packText, setPackText] = useState('')
  // the bag things added into the open pack go in: the pack's own, unless picked otherwise
  const [packBag, setPackBag] = useState<Bag | ''>('')
  const [focusPack, setFocusPack] = useState(false)
  // a new pack before it has a name: nothing is saved until it does, and every try saves the same pack
  const [draft, setDraft] = useState<{ id: string; name: string; bag: Bag | '' } | null>(null)
  const draftRef = useRef<HTMLLIElement>(null)
  // an unnamed new pack goes when you tap anywhere else (its bag menu floats outside it, so that counts as inside)
  useEffect(() => {
    if (!draft || draft.name.trim()) return
    const away = (e: PointerEvent) => {
      const t = e.target as Element | null
      if (draftRef.current?.contains(t) || t?.closest?.('.choice-list')) return
      setDraft(null)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [draft])
  const [editing, setEditing] = useState<Editing | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [copying, setCopying] = useState(false)
  const [copied, setCopied] = useState('')
  // a failed copy is told beside the copy link, at the end, where the person tapped
  const [copyProblem, setCopyProblem] = useState('')
  if (load.state !== 'ready') return <LoadState load={load} />

  const top = () => Math.min(1, ...all.map((p) => p.position)) - 1
  const after = (packId: string) => Math.max(-1, ...all.filter((p) => p.parent_id === packId).map((p) => p.position)) + 1

  async function run(work: () => Promise<unknown>) {
    setBusy(true); setProblem('')
    try { await work(); return true } catch { setProblem("couldn't save"); return false } finally { setBusy(false) }
  }

  // a new loose thing: on the open list, at the top under the add line, in the bag picked there
  async function add() {
    const { text: name, qty } = parseQty(text)
    if (!canEdit || !name || busy) return
    if (await run(() => save.mutateAsync({ trip_id: trip.id, text: name, owner: view, packed_by: [], position: top(), ...(qty > 1 ? { qty } : {}), ...(addBag ? { bag: addBag } : {}) }))) setText('')
  }

  // a thing into the open pack: whose the pack is, at its end
  async function addInto(pack: PackingItem) {
    const { text: name, qty } = parseQty(packText)
    if (!canEdit || !name || busy) return
    const own = packBag && packBag !== (pack.bag ?? '') ? { bag: packBag } : {}
    if (await run(() => save.mutateAsync({ trip_id: trip.id, text: name, owner: pack.owner ?? null, packed_by: [], position: after(pack.id), parent_id: pack.id, ...(qty > 1 ? { qty } : {}), ...own }))) setPackText('')
  }

  async function makePack() {
    const name = draft?.name.trim()
    if (!canEdit || !name || busy || !draft) return
    const { id } = draft
    if (await run(() => save.mutateAsync({ id, trip_id: trip.id, text: name, is_pack: true, owner: view, packed_by: [], position: top(), ...(draft.bag ? { bag: draft.bag } : {}) }))) {
      // a bag filter that would hide the new pack steps aside, so it opens where you can see it
      if (bag && draft.bag !== bag) setBag(null)
      setDraft(null); setOpen(id); setPackText(''); setPackBag(draft.bag); setFocusPack(true)
    }
  }

  // the pack's tick: everything in it packed, or (all packed already) unpacked again, for whoever's list this is
  function tickAll(g: PackGroup) {
    const all = packDone(g)
    for (const t of g.things) if (packed(t) === all) save.mutate({ id: t.id, packed_by: toggled(t, tickFor(t, view, me), ids) })
  }

  // an edit sends only what changed; moving into a pack puts it at the pack's end, out of one at the top
  async function saveEdit() {
    if (!editing) return
    const was = byId.get(editing.id)
    if (!was) return
    const { text: name, qty } = editing.isPack ? { text: editing.text.trim(), qty: 1 }
      : editing.text === typedWithQty(was) ? { text: was.text, qty: qtyOf(was) } : parseQty(editing.text)
    if (!canEdit || !name || busy) return
    const moved = !editing.isPack && editing.parent !== (was.parent_id ?? null)
    // a thing in a pack is whose the pack is
    const owner = editing.parent ? (byId.get(editing.parent)?.owner ?? null) : editing.owner
    const change = {
      id: was.id,
      ...(name !== was.text ? { text: name } : {}),
      ...(!editing.isPack && qty !== qtyOf(was) ? { qty } : {}),
      ...(owner !== (was.owner ?? null) ? { owner } : {}),
      ...(editing.bag !== (was.bag ?? null) ? { bag: editing.bag } : {}),
      ...(moved ? { parent_id: editing.parent, position: editing.parent ? after(editing.parent) : top() } : {}),
    }
    if (Object.keys(change).length === 1) { setEditing(null); return }
    const ok = await run(async () => {
      await save.mutateAsync(change)
      // a pack's things follow it to its new owner
      if (editing.isPack && 'owner' in change) for (const t of all.filter((t) => t.parent_id === was.id && (t.owner ?? null) !== owner)) await save.mutateAsync({ id: t.id, owner })
    })
    if (ok) setEditing(null)
  }

  function remove(p: PackingItem) {
    setEditing(null)
    // a pack goes with everything in it, and comes back with it on undo
    if (p.is_pack) { removeLater([p.id, ...all.filter((t) => t.parent_id === p.id).map((t) => t.id)], p.text); if (open === p.id) setOpen(null) }
    else removeLater(p.id)
  }

  // the open list onto another trip, unticked, packs with their things; what's already there isn't added twice
  async function copyInto(to: Trip) {
    const there = (pq.data ?? []).filter((p) => p.trip_id === to.id)
    const thereById = new Map(there.map((p) => [p.id, p]))
    const key = (p: PackingItem, from: Map<string, PackingItem>) =>
      `${p.is_pack ? 'pack' : ''}|${p.owner ?? ''}|${(p.parent_id ? from.get(p.parent_id)?.text ?? '' : '').trim().toLowerCase()}|${p.text.trim().toLowerCase()}`
    const have = new Map(there.map((p) => [key(p, thereById), p]))
    const ordered = arrange(mine)
    let position = Math.max(-1, ...there.map((p) => p.position)) + 1
    const packIds = new Map<string, string>()
    let made = 0
    setBusy(true); setCopyProblem(''); setCopying(false)
    try {
      const copy = async (p: PackingItem, parent: string | null) => {
        const same = have.get(key(p, byId))
        if (same) return same.id
        const id = newId()
        await save.mutateAsync({ id, trip_id: to.id, text: p.text, owner: p.owner ?? null, packed_by: [], position: position++,
          ...(p.bag ? { bag: p.bag } : {}), ...(qtyOf(p) > 1 ? { qty: qtyOf(p) } : {}), ...(p.is_pack ? { is_pack: true } : {}), ...(parent ? { parent_id: parent } : {}) })
        made++
        have.set(key(p, byId), { ...p, id })
        return id
      }
      for (const g of ordered.packs) {
        packIds.set(g.pack.id, await copy(g.pack, null))
        for (const t of g.things) await copy(t, packIds.get(g.pack.id)!)
      }
      for (const t of ordered.loose) await copy(t, null)
      setCopied(`${made} copied to ${to.name.toLowerCase()}`)
    } catch { setCopyProblem("couldn't copy") }
    finally { setBusy(false) }
  }

  const startEdit = (p: PackingItem) => {
    setEditing({ id: p.id, text: p.is_pack ? p.text : typedWithQty(p), owner: p.owner ?? null, bag: p.bag ?? null, parent: p.parent_id ?? null, isPack: !!p.is_pack })
  }

  const editPanel = (p: PackingItem) => editing && (
    <li key={p.id} className="pack-edit-row">
      <form className="pack-edit" onSubmit={e => { e.preventDefault(); void saveEdit() }}>
        <input className="input" aria-label={editing.isPack ? 'pack name' : 'packing item'} autoFocus value={editing.text} disabled={busy} onChange={e => setEditing({ ...editing, text: e.target.value })} />
        {!editing.isPack && allPacks.length > 0 && <Choices named label="in" value={editing.parent ?? ''} disabled={busy} onPick={(v) => setEditing({ ...editing, parent: v || null })}
          options={[['', 'no pack'], ...allPacks.map((k): [string, string] => [k.id, k.text])]} />}
        <Choices named label="bag" value={editing.bag ?? (editing.parent ? byId.get(editing.parent)?.bag ?? '' : '')} disabled={busy} onPick={(v) => setEditing({ ...editing, bag: v || null })}
          options={[...BAG_KEYS.map((k): [Bag, string] => [k, BAGS[k]]), ['', 'no bag']]} />
        {people.length > 1 && !(editing.parent && !editing.isPack) && <Choices named label="whose" value={editing.owner ?? ''} disabled={busy} onPick={(v) => setEditing({ ...editing, owner: v || null })}
          options={[...ids.map((id): [string, string] => [id, listName(id)]), ['', ids.length === 2 ? 'both' : 'everyone']]} />}
        <div className="row">
          <button type="button" className="btn ghost small" disabled={busy} onClick={() => remove(p)}>remove</button>
          <span className="spacer" />
          <button type="button" className="btn ghost small" disabled={busy} onClick={() => setEditing(null)}>cancel</button>
          <button type="submit" className="btn primary small" disabled={busy || !editing.text.trim()}>save</button>
        </div>
      </form>
    </li>
  )

  const row = (p: PackingItem, inPack = false): ReactNode => editing?.id === p.id ? editPanel(p) : (
    <Row key={p.id} p={p} packed={packed(p)} canEdit={canEdit} bag={bagOf(p, byId)}
      onTick={() => save.mutate({ id: p.id, packed_by: toggled(p, tickFor(p, view, me), ids) })}
      onEdit={() => startEdit(p)} onRemove={() => remove(p)} />
  )

  const pack = (g: PackGroup): ReactNode => {
    if (editing?.id === g.pack.id) return editPanel(g.pack)
    const n = tally(g.things, packed)
    const inside = [...g.things.filter((t) => !packed(t)), ...g.things.filter(packed)]
    return (
      <Pack key={g.pack.id} group={g} bag={((b) => (b.length === 1 ? b[0] : null))(packBags(g.pack, g.things, byId))} open={open === g.pack.id} done={n.done} total={n.total} packedPack={packDone(g)}
        partial={!packDone(g) && g.things.some(packed)} onTickAll={() => tickAll(g)} canEdit={canEdit}
        onToggle={() => { setOpen(open === g.pack.id ? null : g.pack.id); setPackText(''); setPackBag(g.pack.bag ?? ''); setFocusPack(false); setEditing(null) }}
        onEdit={() => startEdit(g.pack)} rows={inside.map((t) => row(t, true))}
        text={packText} addBag={packBag} busy={busy} focus={focusPack} onText={setPackText} onAddBag={setPackBag} onAdd={() => void addInto(g.pack)} />
    )
  }

  const draftRow = draft && !byId.has(draft.id) && (
    <li ref={draftRef} className="pack-group open pack-draft">
      <form className="jot pack-add pack-name-line" onSubmit={(e) => { e.preventDefault(); void makePack() }}>
        <input aria-label="pack name" placeholder="name this pack…" autoFocus value={draft.name} disabled={busy} autoComplete="off" enterKeyHint="done"
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Escape') setDraft(null) }} />
        <ChoiceMenu label={draft.bag ? BAGS[draft.bag] : 'no bag'} ariaLabel="which bag for the pack" className={`pack-add-bag${draft.bag ? ' set' : ''}`} disabled={busy}
          selected={draft.bag} options={[...BAG_KEYS.map((k) => ({ value: k, label: BAGS[k] })), { value: '', label: 'no bag' }]}
          onPick={(v) => setDraft({ ...draft, bag: v as Bag | '' })} />
        <button type="submit" className="btn small line-go" aria-label="make pack" disabled={busy || !draft.name.trim()}>add</button>
      </form>
    </li>
  )

  const toPackPacks = packs.filter((g) => !packDone(g)), donePacks = packs.filter(packDone)
  const toPack = loose.filter((p) => !packed(p)), done = loose.filter(packed)

  return (
    <div className="packing stack">
      {(dates || weather) && <p className="pack-meta">
        {dates}{dates && weather && ' · '}{weather && <span aria-label="weather">{weather}</span>}
      </p>}
      {(people.length > 1 || mine.length > 0) && <>
        <div className="pack-who">
          {people.length > 1 && <div className="pack-tabs small" role="tablist" aria-label="whose list">
            {ids.map((id) => <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => { setPicked(id); setEditing(null) }}>{listName(id)}</button>)}
          </div>}
          {mine.length > 0 && <span className="pack-count num">{count.done} of {count.total} packed</span>}
        </div>
        <div className="pack-meter" aria-hidden="true"><span style={{ width: `${count.total ? Math.round((count.done / count.total) * 100) : 0}%` }} /></div>
      </>}
      {(mine.length > 0 || canEdit) && <div className="pack-filter-row">
        {mine.length > 0 && <Choices label="show bag" value={bag ?? ''} onPick={(v) => { setBag(v || null); setAddBag(v) }}
          options={[['', 'all'], ...BAG_KEYS.map((k): [Bag, string] => [k, BAGS[k]])]} />}
        {canEdit && <button type="button" className="pack-new" disabled={busy || !!draft}
          onClick={() => { setDraft({ id: newId(), name: '', bag: addBag }); setOpen(null); setEditing(null) }}>new pack</button>}
      </div>}
      {canEdit && !editing && <form className="jot pack-add" onSubmit={e => { e.preventDefault(); void add() }}>
        <input ref={addField} aria-label="add to pack" placeholder="add to pack…" value={text} disabled={busy} autoComplete="off" enterKeyHint="done" onChange={e => setText(e.target.value)} />
        <ChoiceMenu label={addBag ? BAGS[addBag] : 'no bag'} ariaLabel="which bag" className={`pack-add-bag${addBag ? ' set' : ''}`} disabled={busy}
          selected={addBag} options={[...BAG_KEYS.map((k) => ({ value: k, label: BAGS[k] })), { value: '', label: 'no bag' }]}
          onPick={(v) => { setAddBag(v as Bag | ''); addField.current?.focus() }} />
        <button type="submit" className="btn small line-go" aria-label="add to pack" disabled={busy || !text.trim()}>add</button>
      </form>}
      {problem && <p role="alert" className="warn-line">{problem}</p>}
      {(draft || toPackPacks.length > 0 || toPack.length > 0) && <ul className="list pack-list" aria-label="packing">
        {draftRow}
        {toPackPacks.map(pack)}
        {toPack.map((p) => row(p))}
      </ul>}
      {(donePacks.length > 0 || done.length > 0) && <>
        <p className="mono-label pack-done-head">packed</p>
        <ul className="list pack-list" aria-label="packed">{donePacks.map(pack)}{done.map((p) => row(p))}</ul>
      </>}
      {canEdit && mine.length > 0 && copyTo.length > 0 && <div className="pack-copy-wrap">
        <button type="button" className="pack-link" aria-expanded={copying} disabled={busy} onClick={() => { setCopying(!copying); setCopied(''); setCopyProblem('') }}>copy this list to…</button>
        {copying && <div className="pack-copy" role="group" aria-label="copy to">
          <span className="mono-label">copy to</span>
          <div className="pack-copy-to">{copyTo.map((t) => <button key={t.id} type="button" disabled={busy} onClick={() => void copyInto(t)}>{t.name.toLowerCase()}</button>)}</div>
        </div>}
        {copied && <p className="pack-status" role="status">{copied}</p>}
        {copyProblem && <p role="alert" className="warn-line">{copyProblem}</p>}
      </div>}
    </div>
  )
}
