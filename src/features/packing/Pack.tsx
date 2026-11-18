import { useEffect, useRef, type ReactNode } from 'react'
import type { PackingItem } from '../../lib/types'
import { qtyLabel, type PackGroup } from '../../lib/packing'

const BAG_WORDS = { check: 'check-in', carry: 'carry-on', wear: 'wear' } as const

// a pack ("shirts", "toiletries bag"): one row with its name, bag and count, and a grey line of what's in it.
// tapped, it opens: its things hang off a thin line, packed ones grey at the end, then its own add line.
// only one opens at a time (the list decides), so at most one pack's add line is ever on screen
type Props = {
  group: PackGroup
  open: boolean
  done: number
  total: number
  packedPack: boolean
  canEdit: boolean
  onToggle: () => void
  onEdit: () => void
  rows: ReactNode
  // the open pack's add line
  text: string
  busy: boolean
  focus: boolean
  onText: (v: string) => void
  onAdd: () => void
}

export const peek = (things: PackingItem[]) => things.map((t) => [t.text, qtyLabel(t)].filter(Boolean).join(' ')).join(' · ')

export function Pack({ group, open, done, total, packedPack, canEdit, onToggle, onEdit, rows, text, busy, focus, onText, onAdd }: Props) {
  const { pack, things } = group
  const name = pack.text
  const field = useRef<HTMLInputElement>(null)
  useEffect(() => { if (open && focus) field.current?.focus() }, [open, focus])
  return (
    <li className={`pack-group${open ? ' open' : ''}${packedPack ? ' packed' : ''}`}>
      <div className="pack-head">
        <button type="button" className="pack-toggle" aria-expanded={open} aria-label={name} onClick={onToggle}>
          <span className="pack-title">
            <span className="pack-group-name">{name}</span>
            {pack.bag && <span className="pack-bag">{BAG_WORDS[pack.bag]}</span>}
            <span className="pack-n num">{done} of {total}</span>
          </span>
          {!open && things.length > 0 && <span className="pack-peek">{peek(things)}</span>}
        </button>
        {/* "edit" sits just after the open pack's name (a hidden copy of the name holds its place), so the bag and count
            stay on the right edge like every other pack's */}
        {open && canEdit && <span className="pack-edit-over">
          <span className="pack-group-name pack-ghost" aria-hidden="true">{name}</span>
          <button type="button" className="pack-edit-link" aria-label={`edit ${name}`} onClick={onEdit}>edit</button>
        </span>}
      </div>
      {open && (
        <ul className="pack-inside" aria-label={name}>
          {rows}
          {canEdit && <li className="pack-inside-add">
            <form className="jot pack-add pack-add-in" onSubmit={(e) => { e.preventDefault(); onAdd() }}>
              <input ref={field} aria-label={`add to ${name}`} placeholder={`add to ${name}…`} value={text} disabled={busy} autoComplete="off" enterKeyHint="done"
                onChange={(e) => onText(e.target.value)} />
              <button type="submit" className="btn small line-go" aria-label={`add to ${name}`} disabled={busy || !text.trim()}>add</button>
            </form>
          </li>}
        </ul>
      )}
    </li>
  )
}
