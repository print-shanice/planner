import type { Place } from '../../lib/types'
import { SearchStatus, usePlaceSearch } from '../plan/usePlaceSearch'
import { Icon } from '../../components/Icon'

type Props = { id: string; label: string; value: Place | null; onChange: (p: Place | null) => void; near?: { lat: number; lng: number } | null }

export function PlaceField({ id, label, value, onChange, near }: Props) {
  const { q, results, failed, busy, change, run, clear } = usePlaceSearch(near)

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
          {results && results.length > 0 && (
            <ul className="results">
              {results.map((p, i) => (
                <li key={p.osm_id ?? i}>
                  <button type="button" className="result" onClick={() => { onChange(p); clear() }}>
                    <Icon name="pin" size={18} />
                    <span className="result-text"><span>{p.name}</span>{p.address && <span className="muted">{p.address}</span>}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
