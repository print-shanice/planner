import type { Mode, Trip } from '../../lib/types'
import { guessKind } from '../../lib/lineKind'
import { useSettle } from './useSettle'
import { useSave, useStops } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { newId } from '../../lib/id'
import { nextPosition } from '../../lib/schedule'
import { blankStop } from '../../lib/stops'
import { dayLabel } from '../../lib/dates'
import { LineEditor, type LineValues } from './LineEditor'
import { flash } from './flash'

// a tag typed after the name: "[to do]" makes it something to do (a note), "[to book]" a place still to book
export function readTag(text: string): { title: string; kind: 'place' | 'note' | 'journey'; status: 'idea' | 'to_book'; mode: Mode | null } {
  const m = /\s*\[(to ?do|to ?book)\]\s*/i.exec(text)
  // no tag: the words say whether it's a place, getting around, or a note
  if (!m) return { title: text.trim(), ...guessKind(text), status: 'idea' }
  const title = (text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim()
  return /to ?do/i.test(m[1]) ? { title, kind: 'note', status: 'to_book', mode: null } : { title, kind: 'place', status: 'to_book', mode: null }
}

// the empty line at the end of a day: type a time and a name, press enter, it's on the day
export function AddLine({ trip, day }: { trip: Trip; day: string | null }) {
  const canEdit = useCanEdit()
  const save = useSave('stops')
  const settle = useSettle()
  const stops = useStops().data ?? []
  if (!canEdit) return null
  const label = `add to ${day ? dayLabel(day) : 'no date'}`

  function add(v: LineValues) {
    const { title, kind, status, mode } = readTag(v.title)
    if (!title) return
    const id = newId()
    const position = nextPosition(stops, trip.id, day)
    const row = {
      id, trip_id: trip.id, kind, title, day, time: v.time || null, end_time: v.end || null,
      status, saved: false, position, ...(kind === 'journey' ? { mode, place: null } : {}),
    }
    save.mutateAsync(row).catch(() => { /* the line stays with "couldn't save" and a retry */ })
    // a time puts it in its place: the day's order is written down so it stays there
    if (row.time) settle(blankStop(kind, trip.id, row))
    flash(id)
  }

  return (
    <div className="add-line">
      <LineEditor label={label} onSubmit={add} />
    </div>
  )
}
