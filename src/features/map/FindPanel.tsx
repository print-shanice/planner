import { useEffect } from 'react'
import type { Stop } from '../../lib/types'
import { useSave } from '../../lib/queries'
import { placeChange } from '../../lib/stops'
import { kindChange } from '../../lib/lineKind'
import { Icon } from '../../components/Icon'
import { SearchResults, usePlaceField } from '../plan/usePlaceSearch'
import { flash } from '../itinerary/flash'

type Props = { stop: Stop; near: { lat: number; lng: number } | null; onDone: () => void }

// "find on the map" for a line typed without a place: its words looked up near its day; the one picked becomes its spot.
// it may not be a place at all, so it can become getting around or a note from here too
export function FindPanel({ stop, near, onDone }: Props) {
  const save = useSave('stops')
  const name = (stop.title || 'this line').toLowerCase()
  const field = usePlaceField(near, (p) => {
    save.mutate(placeChange(stop, p))
    flash(stop.id)
    onDone()
  })
  const { q, change, run } = field
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
      <SearchResults field={field} label="places" max={5} />
      <p className="find-foot"><span className="muted">not a place?</span>
        <button type="button" className="text-link" onClick={() => become('journey')}>getting around</button>
        <button type="button" className="text-link" onClick={() => become('note')}>a note</button>
      </p>
    </section>
  )
}
