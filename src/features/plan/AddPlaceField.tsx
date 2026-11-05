import { useEffect, useRef, useState } from 'react'
import type { Place } from '../../lib/types'
import { searchPlaces } from '../../lib/photon'
import { Icon } from '../../components/Icon'

type Props = { near?: { lat: number; lng: number } | null; onPick: (p: Place) => void; label?: string }

export function AddPlaceField({ near, onPick, label = 'add a place' }: Props) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Place[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const seq = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  async function run(text = q, min = 1) {
    const term = text.trim()
    if (term.length < min) { setResults(null); return }
    const mine = ++seq.current
    setBusy(true); setFailed(false)
    try {
      const out = await searchPlaces(term, near ?? undefined)
      if (mine === seq.current) setResults(out)
    } catch {
      if (mine === seq.current) { setFailed(true); setResults(null) }
    } finally {
      if (mine === seq.current) setBusy(false)
    }
  }

  useEffect(() => () => clearTimeout(timer.current), [])

  function change(v: string) {
    setQ(v)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => run(v, 3), 350)
  }

  function close() { setOpen(false); setQ(''); setResults(null); setFailed(false) }

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
        <input type="search" role="searchbox" aria-label={label} value={q} autoFocus enterKeyHint="search"
          onChange={(e) => change(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); clearTimeout(timer.current); run() }
            if (e.key === 'Escape') close()
          }} />
        <button type="button" className="icon-btn" aria-label="cancel" onClick={close}><Icon name="close" size={18} /></button>
      </div>
      {failed && (
        <div className="search-note">
          <span className="warn-line">search isn't responding</span>
          <button type="button" className="btn ghost small" onClick={() => run()}>retry</button>
        </div>
      )}
      {results && results.length === 0 && !busy && <p className="search-note muted">nothing found</p>}
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
