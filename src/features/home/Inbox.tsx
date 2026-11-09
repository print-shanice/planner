import type { Link, Trip } from '../../lib/types'
import { useSave } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { hostOf, safeUrl } from '../../lib/embed'
import { descendants } from '../../lib/countries'
import { SiteIcon } from '../saved/LinkCard'
import { SaveFailed } from '../../components/SaveFailed'

// links kept without a trip yet: each one goes to a trip right from its row
export function Inbox({ links, trips }: { links: Link[]; trips: Trip[] }) {
  const save = useSave('links')
  const canEdit = useCanEdit()
  const top = trips.filter((t) => !t.parent_id).sort((a, b) => (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999'))
  const ordered = top.flatMap((t) => descendants(t.id, trips).map((id) => trips.find((x) => x.id === id)!).filter(Boolean))
  const sorted = [...links].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
  return (
    <section className="home-section home-inbox" aria-labelledby="inbox-title">
      <div className="section-head"><h2 id="inbox-title" className="head">inbox</h2><span className="mono-label">{links.length}</span></div>
      <ul className="doc-list">
        {sorted.map((l) => (
          <li key={l.id} className="doc-row">
            <a className="doc-row-main" href={safeUrl(l.url) ?? undefined} target="_blank" rel="noopener noreferrer">
              <SiteIcon url={l.url} />
              <span className="stack-xs"><span className="doc-row-title">{l.title || hostOf(l.url)}</span><span className="muted">{[hostOf(l.url), l.note].filter(Boolean).join(' · ')}</span></span>
            </a>
            <select className="text-select" aria-label={`move ${l.title || hostOf(l.url)} to a trip`} value="" disabled={!canEdit}
              onChange={(e) => { if (e.target.value) save.mutate({ id: l.id, trip_id: e.target.value }) }}>
              <option value="">to a trip</option>
              {ordered.map((t) => <option key={t.id} value={t.id}>{t.name.toLowerCase()}</option>)}
            </select>
            <SaveFailed table="links" id={l.id} />
          </li>
        ))}
      </ul>
    </section>
  )
}
