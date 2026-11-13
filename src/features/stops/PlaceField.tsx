import type { Place } from '../../lib/types'
import { SearchResults, usePlaceField } from '../plan/usePlaceSearch'
import { Icon } from '../../components/Icon'

type Props = { id: string; label: string; value: Place | null; onChange: (p: Place | null) => void; near?: { lat: number; lng: number } | null }

export function PlaceField({ id, label, value, onChange, near }: Props) {
  const field = usePlaceField(near, (p) => { onChange(p); field.clear() })
  const { q, change, run } = field

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
          <SearchResults field={field} />
        </>
      )}
    </div>
  )
}
