import { useEffect, useRef, useState } from 'react'
import type { Place } from '../../lib/types'
import { searchPlaces } from '../../lib/photon'
import { Pending } from '../../components/Pending'

const MIN = 3
const WAIT = 350

// one place search for the map and the forms: it says "searching" from the moment there's enough
// to search for, keeps only the latest answer, and never says "nothing found" while still looking
export function usePlaceSearch(near?: { lat: number; lng: number; zoom?: number } | null) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Place[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const seq = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(timer.current), [])

  async function run(text = q, min = 1) {
    clearTimeout(timer.current)
    const term = text.trim()
    if (term.length < min) { seq.current++; setResults(null); setBusy(false); return }
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

  function change(v: string) {
    setQ(v)
    clearTimeout(timer.current)
    const enough = v.trim().length >= MIN
    setBusy(enough)
    if (!enough) { seq.current++; setResults(null); return }
    timer.current = setTimeout(() => run(v, MIN), WAIT)
  }

  function clear() { seq.current++; clearTimeout(timer.current); setQ(''); setResults(null); setFailed(false); setBusy(false) }

  return { q, results, failed, busy, change, run, clear }
}

export function SearchStatus({ busy, failed, results, onRetry }: { busy: boolean; failed: boolean; results: Place[] | null; onRetry: () => void }) {
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
