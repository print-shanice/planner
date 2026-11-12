import { useState } from 'react'
import type { Place } from '../../lib/types'
import { HitRow, PoweredBy, SearchStatus, usePlaceSearch, type Hit } from './usePlaceSearch'
import { usePick } from './usePick'
import { Icon } from '../../components/Icon'
import { Pending } from '../../components/Pending'

// onGrab: a result carried off the list (the laptop's map into the plan); resolve fetches its spot when it's put down
type Props = { near?: { lat: number; lng: number; zoom?: number } | null; onPick: (p: Place) => void; label?: string; alwaysOpen?: boolean; onGrab?: (h: Hit, e: { clientX: number; clientY: number }, resolve: () => Promise<Place>) => void }

export function AddPlaceField({ near, onPick, label = 'add a place', alwaysOpen = false, onGrab }: Props) {
  const [open, setOpen] = useState(alwaysOpen)
  const { q, results, failed, busy, change, run, clear, pick: resolve } = usePlaceSearch(near)
  const { pick, picking, failed: lost } = usePick(resolve, (p) => { onPick(p); close() })

  function close() { setOpen(alwaysOpen); clear() }

  if (!open) {
    return (
      <button type="button" className="add-place" onClick={() => setOpen(true)}>
        <Icon name="plus" size={18} /><span>{label}</span>
      </button>
    )
  }
  return (
    <div className="place-search">
      <div className="search-box">
        <Icon name="search" size={18} />
        <input type="search" role="searchbox" aria-label={label} value={q} autoFocus={!alwaysOpen} enterKeyHint="search" placeholder={alwaysOpen ? label : undefined}
          onChange={(e) => change(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); run() }
            if (e.key === 'Escape') { e.preventDefault(); close() }
          }} />
        {(!alwaysOpen || q) && <button type="button" className="icon-btn" aria-label="cancel" onClick={close}><Icon name="close" size={18} /></button>}
      </div>
      <SearchStatus busy={busy} failed={failed} results={results} onRetry={() => run()} />
      {picking && <div className="search-note"><Pending label="finding the place" /></div>}
      {lost && <p className="warn-line search-note">couldn't get that place</p>}
      {results && results.length > 0 && (
        <ul className="results">
          {results.map((h) => <li key={h.key}><HitRow hit={h} onPick={() => pick(h)} onGrab={onGrab ? (e) => onGrab(h, e, () => resolve(h)) : undefined} /></li>)}
          <li><PoweredBy /></li>
        </ul>
      )}
    </div>
  )
}
