import { useMemo, useState, type FormEvent } from 'react'
import type { Link, Trip } from '../../lib/types'
import { useLinks, useSave, useStops, useTrips } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { extractUrl, findSaved, linkTitle } from '../../lib/capture'
import { newId } from '../../lib/id'
import { useToast } from '../../components/Toast'
import { loadState } from '../../lib/load'
import { normal } from '../../lib/itinerary'
import { descendants } from '../../lib/countries'
import { EmptyState } from '../../components/EmptyState'
import { LoadState } from '../../components/States'
import { Icon } from '../../components/Icon'
import { LinkCard } from './LinkCard'

// a link pasted straight into the trip's links: named after where it came from (renamed, noted or tied to a place
// from its card). the same link twice is one link: already here it says so, from elsewhere it moves here
function AddLink({ trip, links, family }: { trip: Trip; links: Link[]; family: Set<string> }) {
  const save = useSave<Link>('links')
  const canEdit = useCanEdit()
  const toast = useToast()
  const [text, setText] = useState('')
  const [problem, setProblem] = useState<'bad' | 'here' | null>(null)
  if (!canEdit) return null

  function add(e: FormEvent) {
    e.preventDefault()
    const url = extractUrl(text)
    if (!url) { setProblem('bad'); return }
    const already = findSaved(url, links)
    if (already?.trip_id && family.has(already.trip_id)) { setProblem('here'); return }
    setProblem(null)
    const row = already ? { id: already.id, trip_id: trip.id } : { id: newId(), url, title: linkTitle(url), note: '', trip_id: trip.id, stop_id: null }
    save.mutateAsync(row).catch(() => { /* the card stays with "couldn't save" and a retry */ })
    toast.show({ text: `saved to ${trip.name.toLowerCase()}` })
    setText('')
  }

  return (
    <div className="add-place">
      <form className="jot" onSubmit={add}>
        <input type="text" aria-label="add a link" placeholder="add a link…" value={text} autoComplete="off" inputMode="url" enterKeyHint="done"
          onChange={(e) => { setProblem(null); setText(e.target.value) }} />
        <button type="submit" className="btn small line-go" aria-label="add link" disabled={!text.trim()}>add</button>
      </form>
      {problem === 'bad' && <p role="alert" className="warn-line">check the link</p>}
      {problem === 'here' && <p role="status" aria-label="already there" className="warn-line">already in links</p>}
    </div>
  )
}

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
      <AddLink trip={trip} links={links} family={ids} />
      {shown.length === 0 ? <EmptyState title={q ? 'nothing found' : 'no links yet'} /> : (
        <div className="link-list" aria-label="links">{shown.map((l) => <LinkCard key={l.id} link={l} trips={trips} />)}</div>
      )}
    </div>
  )
}
