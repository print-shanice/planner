import { useMemo, useState } from 'react'
import type { Trip } from '../../lib/types'
import { useLinks, useStops, useTrips } from '../../lib/queries'
import { loadState } from '../../lib/load'
import { normal } from '../../lib/itinerary'
import { descendants } from '../../lib/countries'
import { EmptyState } from '../../components/EmptyState'
import { LoadState } from '../../components/States'
import { Icon } from '../../components/Icon'
import { LinkCard } from './LinkCard'

const has = (q: string, ...xs: (string | null | undefined)[]) => !q || xs.some((x) => !!x && normal(x).includes(q))

// the trip's saved links (reels, videos, pages), newest first, each maybe tied to a place
export function LinksTab({ trip }: { trip: Trip }) {
  const tq = useTrips()
  const lq = useLinks()
  const sq = useStops()
  const [query, setQuery] = useState('')
  const trips = tq.data ?? []
  const links = lq.data ?? []
  const stops = sq.data ?? []
  const load = loadState(tq, lq)
  const ids = useMemo(() => new Set(descendants(trip.id, trips)), [trip.id, trips])
  if (load.state !== 'ready' && !links.length) return <LoadState load={load} />
  const q = normal(query.trim())
  const shown = links.filter((l) => l.trip_id && ids.has(l.trip_id))
    .filter((l) => has(q, l.title, l.url, l.note, stops.find((s) => s.id === l.stop_id)?.title))
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
  return (
    <div className="ideas">
      <LoadState load={load} />
      <label className="search-box ideas-search">
        <Icon name="search" size={18} />
        <input type="search" role="searchbox" aria-label="search links" placeholder="search links" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {shown.length === 0 ? <EmptyState title={q ? 'nothing found' : 'no links yet'} /> : (
        <div className="link-list" aria-label="links">{shown.map((l) => <LinkCard key={l.id} link={l} trips={trips} />)}</div>
      )}
    </div>
  )
}
