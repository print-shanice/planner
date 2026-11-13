import { useState } from 'react'
import type { Trip } from '../../lib/types'
import { useLinks, useStops, useTrips } from '../../lib/queries'
import { loadState } from '../../lib/load'
import { dayLabel } from '../../lib/dates'
import { ownerOn } from '../../lib/agenda'
import { safeUrl } from '../../lib/embed'
import { tripNotes, type NoteItem } from '../../lib/notes'
import { EmptyState } from '../../components/EmptyState'
import { LoadState } from '../../components/States'
import { Icon } from '../../components/Icon'
import { useStopSheet } from '../stops/StopSheet'
import { Chip, Marked } from '../itinerary/ItinLine'
import { JotLine } from '../saved/JotLine'

function NoteRow({ item, q }: { item: NoteItem; q: string }) {
  const sheet = useStopSheet()
  const body = (
    <>
      <span className="note-on">
        {item.stop && item.kind === 'stop' ? <Chip stop={item.stop} quiet /> : <Icon name={item.kind === 'link' ? 'link' : 'note'} size={15} />}
        <span className="note-title"><Marked text={item.title} q={q} /></span>
      </span>
      {item.text.trim() && <span className="note-words"><Marked text={item.text} q={q} /></span>}
    </>
  )
  const href = item.link ? safeUrl(item.link.url) : null
  return (
    <li className={`note-row ${item.kind}`}>
      {item.stop ? (
        <button type="button" className="note-main" onClick={() => sheet?.openStop(item.stop!.id, item.date)}>{body}</button>
      ) : href ? (
        <a className="note-main" href={href} target="_blank" rel="noreferrer">{body}</a>
      ) : <div className="note-main">{body}</div>}
    </li>
  )
}

// everything written down for the trip and its side trips, wherever it was typed, read the way the trip goes
export function NotesTab({ trip }: { trip: Trip }) {
  const tq = useTrips()
  const lq = useLinks()
  const sq = useStops()
  const [query, setQuery] = useState('')
  const trips = tq.data ?? []
  const load = loadState(tq, lq, sq)
  if (load.state !== 'ready' && !sq.data?.length) return <LoadState load={load} />
  const notes = tripNotes(trip, trips, sq.data ?? [], lq.data ?? [], query)
  const q = query.trim()
  const nothing = !notes.undated.length && !notes.days.length

  return (
    <div className="ideas notes">
      <LoadState load={load} />
      <label className="search-box ideas-search">
        <Icon name="search" size={18} />
        <input type="search" role="searchbox" aria-label="search notes" placeholder="search notes" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <JotLine trip={trip} kind="note" />
      {nothing && <EmptyState title={q ? 'nothing found' : 'no notes yet'} />}
      {notes.undated.length > 0 && (
        <section className="note-day">
          <h3 className="mono-label">no date</h3>
          <ul className="doc-list" aria-label="no date">{notes.undated.map((n) => <NoteRow key={n.key} item={n} q={q} />)}</ul>
        </section>
      )}
      {notes.days.map((d) => {
        const owner = ownerOn(trip, trips, d.date)
        const label = dayLabel(d.date)
        return (
          <section key={d.date} className="note-day">
            <h3 className="mono-label">{label}{owner.id !== trip.id && <span className="note-trip"> · {owner.name}</span>}</h3>
            <ul className="doc-list" aria-label={label}>{d.items.map((n) => <NoteRow key={n.key} item={n} q={q} />)}</ul>
          </section>
        )
      })}
    </div>
  )
}
