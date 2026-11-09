import type { Place } from '../../lib/types'
import { HitRow, PoweredBy, SearchStatus, usePlaceSearch } from '../plan/usePlaceSearch'
import { usePick } from '../plan/usePick'
import { Icon } from '../../components/Icon'
import { Pending } from '../../components/Pending'

type Props = { id: string; label: string; value: Place | null; onChange: (p: Place | null) => void; near?: { lat: number; lng: number } | null }

export function PlaceField({ id, label, value, onChange, near }: Props) {
  const { q, results, failed, busy, change, run, clear, pick: resolve } = usePlaceSearch(near)
  const { pick, picking, failed: lost } = usePick(resolve, (p) => { onChange(p); clear() })

  return (
    <div className="field">
      <label className="sr-only" htmlFor={id}>{label}</label>
      {value ? (
        <div className="place-chip">
          <Icon name="pin" size={18} />
          <span className="result-text">
            <span className="chip-label">{label}</span>
            <span>{value.name}</span>
            {value.address && <span className="muted">{value.address}</span>}
          </span>
          <button type="button" className="icon-btn" aria-label={`clear ${label}`} onClick={() => onChange(null)}><Icon name="close" size={18} /></button>
        </div>
      ) : (
        <>
          <div className="search-box">
            <Icon name="search" size={18} />
            <input id={id} type="search" placeholder={label} value={q} enterKeyHint="search" autoComplete="off"
              onChange={(e) => change(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); run(q, 1) } }} />
          </div>
          <SearchStatus busy={busy} failed={failed} results={results} onRetry={() => run(q, 1)} />
          {picking && <div className="search-note"><Pending label="finding the place" /></div>}
          {lost && <p className="warn-line search-note">couldn't get that place</p>}
          {results && results.length > 0 && (
            <ul className="results">
              {results.map((h) => <li key={h.key}><HitRow hit={h} onPick={() => pick(h)} /></li>)}
              <li><PoweredBy /></li>
            </ul>
          )}
        </>
      )}
    </div>
  )
}
