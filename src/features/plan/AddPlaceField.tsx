import { useState } from 'react'
import type { Place } from '../../lib/types'
import { SearchStatus, usePlaceSearch } from './usePlaceSearch'
import { Icon } from '../../components/Icon'

type Props = { near?: { lat: number; lng: number; zoom?: number } | null; onPick: (p: Place) => void; label?: string; alwaysOpen?: boolean }

export function AddPlaceField({ near, onPick, label = 'add a place', alwaysOpen = false }: Props) {
  const [open, setOpen] = useState(alwaysOpen)
  const { q, results, failed, busy, change, run, clear } = usePlaceSearch(near)

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
      {results && results.length > 0 && (
        <ul className="results">
          {results.map((p, i) => (
            <li key={`${p.osm_id ?? i}`}>
              <button type="button" className="result" onClick={() => { onPick(p); close() }}>
                <Icon name="pin" size={18} />
                <span className="result-text">
                  <span>{p.name}</span>
                  {p.address && <span className="muted">{p.address}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
