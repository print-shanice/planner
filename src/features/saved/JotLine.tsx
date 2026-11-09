import { useState, type FormEvent } from 'react'
import type { Trip } from '../../lib/types'
import { useSave, useStops, useTrips } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { newId } from '../../lib/id'
import { searchSpots } from '../../lib/photon'
import { biasFor, pickGuess } from '../../lib/guess'
import { asCategory } from '../../lib/categories'
import { Pending } from '../../components/Pending'
import { flash } from '../itinerary/flash'

// write it down first, sort it out later: a name is enough for an idea. a place nearby that plainly
// matches is pinned to it in the background (its kind too); your words stay the name
export function JotLine({ trip }: { trip: Trip }) {
  const canEdit = useCanEdit()
  const save = useSave('stops')
  const stops = useStops().data ?? []
  const trips = useTrips().data ?? []
  const [text, setText] = useState('')
  const [finding, setFinding] = useState(0)
  if (!canEdit) return null

  function add(e: FormEvent) {
    e.preventDefault()
    const title = text.trim()
    if (!title) return
    const id = newId()
    const position = Math.max(-1, ...stops.filter((s) => s.trip_id === trip.id && !s.day).map((s) => s.position)) + 1
    save.mutateAsync({ id, trip_id: trip.id, kind: 'place', title, day: null, position, status: 'idea', saved: true })
      .catch(() => { /* the row stays with "couldn't save" and a retry */ })
    setText('')
    flash(id)
    const near = biasFor(trip, trips, stops, null)
    if (!near) return
    setFinding((n) => n + 1)
    Promise.resolve().then(() => searchSpots(title, near))
      .then((found) => {
        const p = pickGuess(title, found, near)
        if (!p) return
        const { category, ...place } = p
        return save.mutateAsync({ id, place, ...(asCategory(category) ? { category: asCategory(category) } : {}) })
      })
      .catch(() => { /* nothing found: it stays a plain idea */ })
      .finally(() => setFinding((n) => n - 1))
  }

  return (
    <form className="jot" onSubmit={add}>
      <input type="text" aria-label="jot an idea" placeholder="jot an idea…" value={text} autoComplete="off" enterKeyHint="done" onChange={(e) => setText(e.target.value)} />
      <button type="submit" className="btn small line-go" aria-label="add idea" disabled={!text.trim()}>add</button>
      {finding > 0 && <Pending label="finding the place" className="jot-finding" />}
    </form>
  )
}
