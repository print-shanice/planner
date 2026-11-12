import { useEffect, useRef, useState } from 'react'
import type { Place } from '../../lib/types'
import { searchPlaces } from '../../lib/photon'
import { nearFirst } from '../../lib/guess'
import { googleConfigured } from '../../lib/google/config'
import { PlaceSession, type Suggestion } from '../../lib/google/places'
import { todayISO } from '../../lib/dates'
import { Pending } from '../../components/Pending'
import { Icon } from '../../components/Icon'
import { categoryIcon, type Kindish } from '../../lib/categories'

const MIN = 3
const WAIT = 300

// a search result: photon's already carry the place; google's fetch it (place details) only when picked
export type Hit = { key: string; name: string; sub: string; category?: string; place?: Place; suggestion?: Suggestion }

// one place search for the map and the forms: google when it's set up, else openstreetmap (photon).
// it says "searching" from the moment there's enough to search for, keeps only the latest answer,
// and never says "nothing found" while still looking
export function usePlaceSearch(near?: { lat: number; lng: number; zoom?: number } | null) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Hit[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const seq = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const session = useRef<PlaceSession | null>(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  async function find(term: string): Promise<Hit[]> {
    if (googleConfigured()) {
      session.current ??= new PlaceSession()
      const out = await session.current.suggest(term, near)
      return out.map((s) => ({ key: s.id, name: s.name, sub: s.sub, category: s.category, suggestion: s }))
    }
    const out = nearFirst(await searchPlaces(term, near ?? undefined), near)
    return out.map((p, i) => ({ key: p.osm_id ?? `${p.name}-${i}`, name: p.name, sub: p.address ?? '', category: p.category, place: p }))
  }

  async function run(text = q, min = 1) {
    clearTimeout(timer.current)
    const term = text.trim()
    if (term.length < min) { seq.current++; setResults(null); setBusy(false); return }
    const mine = ++seq.current
    setBusy(true); setFailed(false)
    try {
      const out = await find(term)
      if (mine === seq.current) setResults(out)
    } catch {
      if (mine === seq.current) { setFailed(true); setResults(null) }
    } finally {
      if (mine === seq.current) setBusy(false)
    }
  }

  function change(v: string) {
    setQ(v)
    clearTimeout(timer.current)
    const enough = v.trim().length >= MIN
    setBusy(enough)
    if (!enough) { seq.current++; setResults(null); return }
    timer.current = setTimeout(() => run(v, MIN), WAIT)
  }

  function clear() { seq.current++; clearTimeout(timer.current); setQ(''); setResults(null); setFailed(false); setBusy(false) }

  // the place itself, ending google's search session
  async function pick(h: Hit): Promise<Place> {
    if (h.place) return h.place
    const s = session.current ?? new PlaceSession()
    session.current = null
    return s.pick(h.suggestion!, todayISO())
  }

  return { q, results, failed, busy, change, run, clear, pick }
}

export function SearchStatus({ busy, failed, results, onRetry }: { busy: boolean; failed: boolean; results: unknown[] | null; onRetry: () => void }) {
  if (busy) return <div className="search-note"><Pending label="searching" /></div>
  if (failed) return (
    <div className="search-note">
      <span className="warn-line">search isn't responding</span>
      <button type="button" className="btn ghost small" onClick={onRetry}>retry</button>
    </div>
  )
  if (results && results.length === 0) return <p className="search-note muted">nothing found</p>
  return null
}

// one row of results, the same in every search
// onGrab: on a laptop's map, a result can also be carried into the plan beside it
export function HitRow({ hit, onPick, onGrab }: { hit: Hit; onPick: () => void; onGrab?: (e: { clientX: number; clientY: number }) => void }) {
  return (
    <button type="button" className="result" onClick={onPick} onPointerDown={onGrab ? (e) => { if (e.button === 0) onGrab(e) } : undefined}>
      <Icon name={categoryIcon((hit.category as Kindish) ?? 'place') || 'pin'} size={18} />
      <span className="result-text"><span>{hit.name}</span>{hit.sub && <span className="muted">{hit.sub}</span>}</span>
    </button>
  )
}

// google's search results must say where they came from when there's no google map beside them
export function PoweredBy() {
  if (!googleConfigured()) return null
  return <p className="powered-by" translate="no">Google Maps</p>
}
