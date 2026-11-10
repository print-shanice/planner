import type { Link, Trip } from '../../lib/types'
import { useSave } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { safeUrl } from '../../lib/embed'
import { linkName } from '../../lib/capture'
import { useUndoRemove } from '../../lib/undo'
import { useSwipeAway } from '../../lib/swipe'
import { descendants } from '../../lib/countries'
import { SiteIcon } from '../saved/LinkCard'
import { SaveFailed } from '../../components/SaveFailed'

type RowProps = { link: Link; trips: Trip[]; canEdit: boolean; onMove: (trip: string) => void; onRemove: () => void }

function Row({ link, trips, canEdit, onMove, onRemove }: RowProps) {
  const swipe = useSwipeAway(onRemove, canEdit)
  const name = linkName(link)
  return (
    <li className="doc-row inbox-row" {...swipe}>
      <a className="doc-row-main" href={safeUrl(link.url) ?? undefined} target="_blank" rel="noopener noreferrer">
        <SiteIcon url={link.url} />
        <span className="stack-xs"><span className="doc-row-title">{name.title}</span>{name.sub && <span className="muted">{name.sub}</span>}</span>
      </a>
      <select className="text-select" aria-label={`move ${name.title} to a trip`} value="" disabled={!canEdit}
        onChange={(e) => { if (e.target.value) onMove(e.target.value) }}>
        <option value="">to a trip</option>
        {trips.map((t) => <option key={t.id} value={t.id}>{t.name.toLowerCase()}</option>)}
      </select>
      <SaveFailed table="links" id={link.id} />
    </li>
  )
}

// links kept without a trip yet: each one goes to a trip right from its row, or is swiped away
export function Inbox({ links, trips }: { links: Link[]; trips: Trip[] }) {
  const save = useSave('links')
  const canEdit = useCanEdit()
  const removeLater = useUndoRemove('links')
  const top = trips.filter((t) => !t.parent_id).sort((a, b) => (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999'))
  const ordered = top.flatMap((t) => descendants(t.id, trips).map((id) => trips.find((x) => x.id === id)!).filter(Boolean))
  const sorted = [...links].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
  return (
    <section className="home-section home-inbox" aria-labelledby="inbox-title">
      <div className="section-head"><h2 id="inbox-title" className="head">inbox</h2><span className="mono-label">{links.length}</span></div>
      <ul className="doc-list">
        {sorted.map((l) => (
          <Row key={l.id} link={l} trips={ordered} canEdit={canEdit} onMove={(trip) => save.mutate({ id: l.id, trip_id: trip })} onRemove={() => removeLater(l.id)} />
        ))}
      </ul>
    </section>
  )
}
