import { useState } from 'react'
import type { Link, Trip } from '../../lib/types'
import { useSave } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { safeUrl } from '../../lib/embed'
import { linkName } from '../../lib/capture'
import { useUndoRemove } from '../../lib/undo'
import { useSwipeAway } from '../../lib/swipe'
import { countdown, todayISO } from '../../lib/dates'
import { ChoiceMenu, type Choice } from '../../components/ChoiceMenu'
import { Icon } from '../../components/Icon'
import { SiteIcon } from '../saved/LinkCard'
import { SaveFailed } from '../../components/SaveFailed'
import { tripItems } from './Trips'

const byStart = (a: Trip, b: Trip) => (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999') || a.name.localeCompare(b.name)
const links = (n: number) => `${n} ${n === 1 ? 'link' : 'links'}`

// every trip for "to a trip": what's coming first (soonest on top), then past ones (newest first), side trips under their parent
export function tripChoices(trips: Trip[], today = todayISO()): Choice[] {
  const top = trips.filter((t) => !t.parent_id)
  const ended = (t: Trip) => countdown(t, today).kind === 'done'
  const ordered = [...top.filter((t) => !ended(t)).sort(byStart), ...top.filter(ended).sort((a, b) => byStart(b, a))]
  return tripItems(ordered, trips, today, true)
    .map(({ trip, depth }) => ({ value: trip.id, label: trip.name.toLowerCase(), color: trip.color, depth }))
}

type RowProps = { link: Link; choices: Choice[]; canEdit: boolean; onMove: (trip: string) => void; onRemove: () => void }

function Row({ link, choices, canEdit, onMove, onRemove }: RowProps) {
  const swipe = useSwipeAway(onRemove, canEdit)
  const name = linkName(link)
  return (
    <li className="doc-row inbox-row" {...swipe}>
      <a className="doc-row-main" href={safeUrl(link.url) ?? undefined} target="_blank" rel="noopener noreferrer">
        <SiteIcon url={link.url} />
        <span className="stack-xs"><span className="doc-row-title">{name.title}</span>{name.sub && <span className="muted">{name.sub}</span>}</span>
      </a>
      <ChoiceMenu label="to a trip" ariaLabel={`move ${name.title} to a trip`} options={choices} onPick={onMove} disabled={!canEdit} />
      <SaveFailed table="links" id={link.id} />
    </li>
  )
}

// while picking: the whole row is the tick, and nothing opens
function PickRow({ link, on, onToggle }: { link: Link; on: boolean; onToggle: () => void }) {
  const name = linkName(link)
  return (
    <li className={`doc-row inbox-row picking${on ? ' on' : ''}`}>
      <label className="doc-row-main">
        <input type="checkbox" className="pick-box" aria-label={name.title} checked={on} onChange={onToggle} />
        <span className="tick" aria-hidden="true">{on && <Icon name="check" size={16} />}</span>
        <SiteIcon url={link.url} />
        <span className="stack-xs"><span className="doc-row-title">{name.title}</span>{name.sub && <span className="muted">{name.sub}</span>}</span>
      </label>
    </li>
  )
}

// links kept without a trip yet: each goes to a trip from its row or is swiped away; "select" does several at once
export function Inbox({ links: all, trips }: { links: Link[]; trips: Trip[] }) {
  const save = useSave('links')
  const canEdit = useCanEdit()
  const removeLater = useUndoRemove('links')
  const choices = tripChoices(trips)
  const sorted = [...all].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
  const [picking, setPicking] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  // only links still here count (one may have been moved by the other person meanwhile)
  const chosen = sorted.filter((l) => picked.has(l.id)).map((l) => l.id)
  const n = chosen.length

  const stop = () => { setPicking(false); setPicked(new Set()) }
  const toggle = (id: string) => setPicked((p) => { const next = new Set(p); if (next.has(id)) next.delete(id); else next.add(id); return next })

  return (
    <section className="home-section home-inbox" aria-label="inbox">
      <div className="inbox-tools">
        {picking ? (
          <>
            <button type="button" className="text-link" onClick={() => setPicked(new Set(sorted.map((l) => l.id)))}>all</button>
            <button type="button" className="text-link" onClick={stop}>done</button>
          </>
        ) : (
          <button type="button" className="text-link" disabled={!canEdit} onClick={() => setPicking(true)}>select</button>
        )}
      </div>
      <ul className="doc-list">
        {sorted.map((l) => picking
          ? <PickRow key={l.id} link={l} on={picked.has(l.id)} onToggle={() => toggle(l.id)} />
          : <Row key={l.id} link={l} choices={choices} canEdit={canEdit} onMove={(trip) => save.mutate({ id: l.id, trip_id: trip })} onRemove={() => removeLater(l.id)} />)}
      </ul>
      {picking && (
        <div className="bulk-bar" role="region" aria-label="selected links">
          <span className="bulk-count">{n} selected</span>
          <ChoiceMenu label="to a trip" ariaLabel={`move ${links(n)} to a trip`} options={choices} disabled={!n || !canEdit}
            onPick={(trip) => { chosen.forEach((id) => save.mutate({ id, trip_id: trip })); stop() }} />
          <button type="button" className="text-link bulk-delete" aria-label={`delete ${links(n)}`} disabled={!n || !canEdit}
            onClick={() => { removeLater(chosen); stop() }}>delete</button>
        </div>
      )}
    </section>
  )
}
