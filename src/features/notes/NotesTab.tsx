import { useState } from 'react'
import type { Trip } from '../../lib/types'
import { useLinks, useRemove, useStops, useTrips } from '../../lib/queries'
import { loadState } from '../../lib/load'
import { fmtDay } from '../../lib/dates'
import { ownerOn } from '../../lib/agenda'
import { safeUrl } from '../../lib/embed'
import { tripNotes, type NoteItem } from '../../lib/notes'
import { EmptyState } from '../../components/EmptyState'
import { LoadState } from '../../components/States'
import { Icon } from '../../components/Icon'
import { useStopSheet } from '../stops/StopSheet'
import { Chip, Marked } from '../itinerary/ItinLine'
import { JotLine } from '../saved/JotLine'
import { Sheet } from '../../components/Sheet'
import { CaptureForm } from '../capture/CaptureForm'
import { useCanEdit } from '../../lib/offline'

function NoteRow({ item, q }: { item: NoteItem; q: string }) {
  const sheet = useStopSheet()
  const body = (
    <>
      <span className="note-on">
        {item.stop && item.kind === 'stop' ? <Chip stop={item.stop} quiet /> : <span className="cat"><Icon name={item.kind === 'link' ? 'link' : 'note'} size={15} /></span>}
        <span className="note-title"><Marked text={item.title} q={q} /></span>
      </span>
      {item.text.trim() && <span className="note-words"><Marked text={item.text} q={q} /></span>}
    </>
  )
  const href = item.link ? safeUrl(item.link.url) : null
  const [editing, setEditing] = useState(false)
  const remove = useRemove('links')
  const canEdit = useCanEdit()
  // a row's one action is its "edit" word, like packing (shanice, 18 nov); a link's note still opens the link
  return (
    <li className={`note-row ${item.kind}`}>
      {href && !item.stop ? <a className="note-main" href={href} target="_blank" rel="noreferrer">{body}</a> : <div className="note-main">{body}</div>}
      {item.stop && <button type="button" className="row-edit" aria-label={`edit ${item.title}`} onClick={() => sheet?.openStop(item.stop!.id, item.date)}>edit</button>}
      {!item.stop && item.link && canEdit && <>
        <button type="button" className="row-edit" aria-label={`edit ${item.title}`} onClick={() => setEditing(true)}>edit</button>
        <Sheet page open={editing} title="edit link" onClose={() => setEditing(false)}>
          <CaptureForm initial={null} tripId={item.link.trip_id} link={item.link} onDone={() => setEditing(false)}
            onRemove={() => { setEditing(false); remove.mutate(item.link!.id) }} />
        </Sheet>
      </>}
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
          <h3 className="doc-date note-day-h">no date</h3>
          <ul className="doc-list" aria-label="no date">{notes.undated.map((n) => <NoteRow key={n.key} item={n} q={q} />)}</ul>
        </section>
      )}
      {notes.days.map((d) => {
        const owner = ownerOn(trip, trips, d.date)
        const label = fmtDay(d.date, { weekday: 'long', day: 'numeric', month: 'long' })
        return (
          <section key={d.date} className="note-day">
            <h3 className="doc-date note-day-h">{label}{owner.id !== trip.id && <span className="note-trip"> · {owner.name}</span>}</h3>
            <ul className="doc-list" aria-label={label}>{d.items.map((n) => <NoteRow key={n.key} item={n} q={q} />)}</ul>
          </section>
        )
      })}
    </div>
  )
}
