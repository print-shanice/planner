import { useEffect, useRef, useState } from 'react'
import type { Place } from '../../lib/types'
import { searchPlaces } from '../../lib/photon'
import { Icon } from '../../components/Icon'

type Props = { id: string; label: string; value: Place | null; onChange: (p: Place | null) => void; near?: { lat: number; lng: number } | null }

export function PlaceField({ id, label, value, onChange, near }: Props) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Place[] | null>(null)
  const [failed, setFailed] = useState(false)
  const seq = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(timer.current), [])

  async function run(text: string, min: number) {
    const term = text.trim()
    if (term.length < min) { setResults(null); return }
    const mine = ++seq.current
    setFailed(false)
    try {
      const out = await searchPlaces(term, near ?? undefined)
      if (mine === seq.current) setResults(out)
    } catch {
      if (mine === seq.current) { setFailed(true); setResults(null) }
    }
  }

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
              onChange={(e) => { const v = e.target.value; setQ(v); clearTimeout(timer.current); timer.current = setTimeout(() => run(v, 3), 300) }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(timer.current); run(q, 1) } }} />
          </div>
          {failed && (
            <div className="search-note">
              <span className="warn-line">search isn't responding</span>
              <button type="button" className="btn ghost small" onClick={() => run(q, 1)}>retry</button>
            </div>
          )}
          {results && results.length > 0 && (
            <ul className="results">
              {results.map((p, i) => (
                <li key={p.osm_id ?? i}>
                  <button type="button" className="result" onClick={() => { onChange(p); setQ(''); setResults(null) }}>
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
