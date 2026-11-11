import { useState } from 'react'
import type { Trip } from '../../lib/types'
import { useSave, useStops, useTrips } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { newId } from '../../lib/id'
import { searchSpots } from '../../lib/photon'
import { biasFor, pickGuess } from '../../lib/guess'
import { Pending } from '../../components/Pending'
import { dayLabel } from '../../components/MonthCalendar'
import { LineEditor, type LineValues } from './LineEditor'
import { flash } from './flash'

// a tag typed after the name: "[to do]" makes it something to do (a note), "[to book]" a place still to book
export function readTag(text: string): { title: string; kind: 'place' | 'note'; status: 'idea' | 'to_book' } {
  const m = /\s*\[(to ?do|to ?book)\]\s*/i.exec(text)
  if (!m) return { title: text.trim(), kind: 'place', status: 'idea' }
  const title = (text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim()
  return /to ?do/i.test(m[1]) ? { title, kind: 'note', status: 'to_book' } : { title, kind: 'place', status: 'to_book' }
}

// the empty line at the end of a day: type a time and a name, press enter, it's on the day
export function AddLine({ trip, day }: { trip: Trip; day: string | null }) {
  const canEdit = useCanEdit()
  const save = useSave('stops')
  const stops = useStops().data ?? []
  const trips = useTrips().data ?? []
  const [finding, setFinding] = useState(0)
  if (!canEdit) return null
  const label = `add to ${day ? dayLabel(day) : 'no date'}`

  function add(v: LineValues): string | null {
    const { title, kind, status } = readTag(v.title)
    if (!title) return null
    const id = newId()
    const position = Math.max(-1, ...stops.filter((s) => s.trip_id === trip.id && (s.day ?? null) === day).map((s) => s.position)) + 1
    save.mutateAsync({
      id, trip_id: trip.id, kind, title, day, time: v.time || null, end_time: v.end || null,
      status, saved: false, position,
    }).catch(() => { /* the line stays with "couldn't save" and a retry */ })
    flash(id)
    // a to-do has no place to find on the map
    const near = kind === 'place' ? biasFor(trip, trips, stops, day) : null
    if (near) {
      setFinding((n) => n + 1)
      Promise.resolve().then(() => searchSpots(title, near))
        .then((found) => { const p = pickGuess(title, found, near); if (p) return save.mutateAsync({ id, place: p }) })
        .catch(() => { /* no place found: the line just has no pin */ })
        .finally(() => setFinding((n) => n - 1))
    }
    return null
  }

  return (
    <div className="add-line">
      <LineEditor label={label} onSubmit={add} />
      {finding > 0 && <Pending label="finding the place" className="add-line-finding" />}
    </div>
  )
}
