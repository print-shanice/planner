import type { Place } from '../../lib/types'
import { Icon } from '../../components/Icon'
import { SearchStatus, usePlaceSearch } from '../plan/usePlaceSearch'

type Props = {
  label: string; name: string; place: Place | null; near?: { lat: number; lng: number } | null; autoFocus?: boolean
  onName: (name: string) => void; onPlace: (p: Place | null) => void
}

// one field for a name and its place: typing searches for real places, picking one fills both;
// your own words still work without a place on the map
export function NamePlace({ label, name, place, near, autoFocus, onName, onPlace }: Props) {
  const { results, failed, busy, change, run, clear } = usePlaceSearch(near)
  return (
    <div className="name-place">
      <input className="title-input" aria-label={label} placeholder={label} value={name} autoFocus={autoFocus} autoComplete="off"
        onChange={(e) => { onName(e.target.value); if (!place) change(e.target.value) }} />
      {place ? (
        <div className="name-place-at">
          <Icon name="pin" size={16} />
          <span>{[place.address, place.city].filter(Boolean).join(', ') || place.name}</span>
          <button type="button" className="icon-btn" aria-label="clear location" onClick={() => { onPlace(null); change(name) }}><Icon name="close" size={16} /></button>
        </div>
      ) : (
        <>
          <SearchStatus busy={busy} failed={failed} results={null} onRetry={() => run(name, 1)} />
          {results && results.length > 0 && (
            <ul className="results" aria-label="places">
              {results.map((p, i) => (
                <li key={p.osm_id ?? i}>
                  <button type="button" className="result" onClick={() => { onPlace(p); clear() }}>
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
