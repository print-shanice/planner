import { useEffect } from 'react'
import type { Stop } from '../../lib/types'
import { useSave } from '../../lib/queries'
import { asCategory } from '../../lib/categories'
import { kindChange } from '../../lib/lineKind'
import { Icon } from '../../components/Icon'
import { Pending } from '../../components/Pending'
import { HitRow, PoweredBy, SearchStatus, usePlaceSearch } from '../plan/usePlaceSearch'
import { usePick } from '../plan/usePick'
import { flash } from '../itinerary/flash'

type Props = { stop: Stop; near: { lat: number; lng: number } | null; onDone: () => void }

// "find on the map" for a line typed without a place: its words looked up near its day; the one picked becomes its spot.
// it may not be a place at all, so it can become getting around or a note from here too
export function FindPanel({ stop, near, onDone }: Props) {
  const save = useSave('stops')
  const { q, results, failed, busy, change, run, pick: resolve } = usePlaceSearch(near)
  const name = (stop.title || 'this line').toLowerCase()
  const { pick, picking, failed: lost } = usePick(resolve, (p) => {
    const { category, ...bare } = p
    save.mutate({ id: stop.id, place: bare, ...(stop.category ? {} : { category: asCategory(category) }) })
    flash(stop.id)
    onDone()
  })
  useEffect(() => { change(stop.title); void run(stop.title, 1) }, [stop.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const become = (k: 'journey' | 'note') => { save.mutate(kindChange(stop, k)); flash(stop.id); onDone() }

  return (
    <section className="find-panel" aria-label={`find ${name} on the map`}>
      <div className="find-head">
        <div className="stack-xs"><p className="mono-label">find on the map</p><p className="find-title">{name}</p></div>
        <button type="button" className="icon-btn" aria-label="close" onClick={onDone}><Icon name="close" size={18} /></button>
      </div>
      <div className="search-box">
        <Icon name="search" size={18} />
        <input type="search" role="searchbox" aria-label={`find ${name}`} value={q} enterKeyHint="search"
          onChange={(e) => change(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void run() } }} />
      </div>
      <SearchStatus busy={busy} failed={failed} results={results} onRetry={() => run(q, 1)} />
      {picking && <div className="search-note"><Pending label="finding the place" /></div>}
      {lost && <p className="warn-line search-note">couldn't get that place</p>}
      {results && results.length > 0 && (
        <ul className="results" aria-label="places">
          {results.slice(0, 5).map((h) => <li key={h.key}><HitRow hit={h} onPick={() => pick(h)} /></li>)}
          <li><PoweredBy /></li>
        </ul>
      )}
      <p className="find-foot"><span className="muted">not a place?</span>
        <button type="button" className="text-link" onClick={() => become('journey')}>getting around</button>
        <button type="button" className="text-link" onClick={() => become('note')}>a note</button>
      </p>
    </section>
  )
}
