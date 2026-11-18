import { useEffect, useId, useRef, type ReactNode } from 'react'
import type { Bag } from '../../lib/types'
import type { PackGroup } from '../../lib/packing'
import { ChoiceMenu } from '../../components/ChoiceMenu'
import { SaveFailed } from '../../components/SaveFailed'
import { Icon } from '../../components/Icon'

const BAG_WORDS: Record<Bag, string> = { check: 'check-in', carry: 'carry-on', wear: 'wear' }
const BAG_KEYS = Object.keys(BAG_WORDS) as Bag[]

// a pack ("shirts", "toiletries bag"): its tick, its name with the chevron the trips' list folds with (right folded, down open),
// "edit" (as every thing has), its bag when everything in it shares one, and its count.
// tapped, it opens: its things hang off a thin line, packed ones grey at the end, then its own add line.
// only one opens at a time (the list decides), so at most one pack's add line is ever on screen
type Props = {
  group: PackGroup
  // the one bag everything in it goes in; none when it depends
  bag: Bag | null
  open: boolean
  done: number
  total: number
  packedPack: boolean
  canEdit: boolean
  onToggle: () => void
  onEdit: () => void
  rows: ReactNode
  // the open pack's add line, with the bag new things go in (the pack's, unless picked otherwise)
  text: string
  addBag: Bag | ''
  busy: boolean
  focus: boolean
  onText: (v: string) => void
  onAddBag: (b: Bag | '') => void
  onAdd: () => void
  // the pack's own tick: everything inside packed or not (some packed shows a dash)
  partial: boolean
  onTickAll: () => void
}

export function Pack({ group, bag, open, done, total, packedPack, canEdit, onToggle, onEdit, rows, text, addBag, busy, focus, onText, onAddBag, onAdd, partial, onTickAll }: Props) {
  const { pack, things } = group
  const name = pack.text
  const field = useRef<HTMLInputElement>(null)
  const metaId = useId()
  const tick = useRef<HTMLInputElement>(null)
  useEffect(() => { if (open && focus) field.current?.focus() }, [open, focus])
  useEffect(() => { if (tick.current) tick.current.indeterminate = partial }, [partial])
  return (
    <li className={`pack-group${open ? ' open' : ''}${packedPack ? ' packed' : ''}${partial ? ' partial' : ''}`}>
      {/* the name is the fold button; the bag and count fold it too, and are read out as its description */}
      <div className="pack-head">
        <label className="pack-tick">
          <input ref={tick} type="checkbox" aria-label={`everything in ${name}`} checked={packedPack} disabled={!canEdit || !things.length} onChange={onTickAll} />
          <span className="tick" aria-hidden="true" />
        </label>
        <button type="button" className="pack-toggle" aria-expanded={open} aria-describedby={metaId} onClick={onToggle}>
          <span className="pack-toggle-name">{name}</span>
          {/* how many it holds, written like a thing's ×3: "shirts ×6" is six shirts, whatever's packed */}
          {total > 0 && <span className="pack-qty num" aria-hidden="true">×{total}</span>}
          <Icon name="chevron" size={16} />
        </button>
        {canEdit && <button type="button" className="pack-edit-link" aria-label={`edit ${name}`} onClick={onEdit}>edit</button>}
        <span className="pack-meta-r" id={metaId} onClick={onToggle}>
          {bag && <span className="pack-bag">{BAG_WORDS[bag]}</span>}
          <span className="pack-n num">{done} of {total}</span>
        </span>
        <SaveFailed table="packing" id={pack.id} />
      </div>
      {open && (
        <ul className="pack-inside" aria-label={name}>
          {rows}
          {canEdit && <li className="pack-inside-add">
            <form className="jot pack-add pack-add-in" onSubmit={(e) => { e.preventDefault(); onAdd() }}>
              <input ref={field} aria-label={`add to ${name}`} placeholder={`add to ${name}…`} value={text} disabled={busy} autoComplete="off" enterKeyHint="done"
                onChange={(e) => onText(e.target.value)} />
              <ChoiceMenu label={addBag ? BAG_WORDS[addBag] : 'no bag'} ariaLabel={`which bag in ${name}`} className={`pack-add-bag${addBag ? ' set' : ''}`} disabled={busy}
                selected={addBag} options={[...BAG_KEYS.map((k) => ({ value: k, label: BAG_WORDS[k] })), { value: '', label: 'no bag' }]}
                onPick={(v) => { onAddBag(v as Bag | ''); field.current?.focus() }} />
              <button type="submit" className="btn small line-go" aria-label={`add to ${name}`} disabled={busy || !text.trim()}>add</button>
            </form>
          </li>}
        </ul>
      )}
    </li>
  )
}
