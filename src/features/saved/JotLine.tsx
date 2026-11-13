import { useState, type FormEvent } from 'react'
import type { Trip } from '../../lib/types'
import { useSave, useStops } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { newId } from '../../lib/id'
import { nextPosition } from '../../lib/schedule'
import { flash } from '../itinerary/flash'

// write it down first, sort it out later: a name is enough. a place, like a typed line of the plan, is pinned by
// the trip's place finder (useAutoLocate) to a spot nearby that plainly matches; your words stay the name
export function JotLine({ trip, kind }: { trip: Trip; kind: 'place' | 'note' }) {
  const canEdit = useCanEdit()
  const save = useSave('stops')
  const stops = useStops().data ?? []
  const [text, setText] = useState('')
  if (!canEdit) return null

  function add(e: FormEvent) {
    e.preventDefault()
    const title = text.trim()
    if (!title) return
    const id = newId()
    save.mutateAsync({ id, trip_id: trip.id, kind, title, day: null, position: nextPosition(stops, trip.id, null), status: 'idea', saved: true })
      .catch(() => { /* the row stays with "couldn't save" and a retry */ })
    setText('')
    flash(id)
  }

  return (
    <form className="jot" onSubmit={add}>
      <input type="text" aria-label={`jot a ${kind}`} placeholder={`jot a ${kind}…`} value={text} autoComplete="off" enterKeyHint="done" onChange={(e) => setText(e.target.value)} />
      <button type="submit" className="btn small line-go" aria-label={`add ${kind}`} disabled={!text.trim()}>add</button>
    </form>
  )
}
