import { useState } from 'react'
import type { Place, Stop, Trip } from '../../lib/types'
import { useSave, useStops } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { fmtDay, tripDays } from '../../lib/dates'
import { gmapsUrl } from '../../lib/gmaps'
import { Icon } from '../../components/Icon'
import { Button } from '../../components/Button'
import { useStopSheet } from '../stops/StopSheet'
import { stopTitle } from '../plan/StopRow'
import { saveError } from '../stops/errors'

type Props = { trip: Trip; place: Place; stop?: Stop; defaultDay?: string | null; onClose: () => void; onDone?: () => void }

const KIND: Record<string, string> = { place: 'place', stay: 'stay', journey: 'journey', note: 'note' }

export function PlaceCard({ trip, place, stop, defaultDay, onClose, onDone }: Props) {
  const stops = useStops().data ?? []
  const save = useSave('stops')
  const canEdit = useCanEdit()
  const sheet = useStopSheet()
  const days = tripDays(trip)
  const [day, setDay] = useState<string>(defaultDay && days.includes(defaultDay) ? defaultDay : days[0] ?? '')
  const [problem, setProblem] = useState<string | null>(null)
  const title = stop ? stopTitle(stop) : place.name || 'dropped pin'
  const maps = gmapsUrl(stop ?? ({ kind: 'place', place } as Stop))
  const sub = [stop ? (stop.day ? fmtDay(stop.day, { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '') : KIND[stop.kind]) : null, place.address].filter(Boolean).join(' · ')

  const lastOn = (d: string | null) => Math.max(-1, ...stops.filter((s) => s.trip_id === trip.id && (s.day ?? null) === d).map((s) => s.position)) + 1

  async function run(fn: () => Promise<unknown>) {
    setProblem(null)
    try { await fn(); onDone?.() } catch (e) { setProblem(saveError(e)) }
  }

  const add = () => run(() => save.mutateAsync({ trip_id: trip.id, kind: 'place', title: place.name || 'dropped pin', day: day || null, position: lastOn(day || null), place, status: 'idea' }))
  const toggleSave = () => run(() => (stop
    ? save.mutateAsync({ id: stop.id, saved: !stop.saved })
    : save.mutateAsync({ trip_id: trip.id, kind: 'place', title: place.name || 'dropped pin', day: null, position: lastOn(null), place, saved: true, status: 'idea' })))

  return (
    <section className="place-card" aria-label={title}>
      <div className="place-card-head">
        <div className="stack-xs">
          <h3 className="head">{title}</h3>
          {sub && <p className="muted">{sub}</p>}
        </div>
        <button type="button" className="icon-btn" aria-label="close" onClick={onClose}><Icon name="close" size={18} /></button>
      </div>
      <div className="place-card-actions">
        {stop ? (
          <Button variant="primary" onClick={() => sheet?.openStop(stop.id)}>details</Button>
        ) : (
          <>
            {days.length > 0 && (
              <select aria-label="day" className="input day-select" value={day} onChange={(e) => setDay(e.target.value)}>
                {days.map((d) => <option key={d} value={d}>{fmtDay(d, { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '')}</option>)}
              </select>
            )}
            <Button variant="primary" disabled={!canEdit} onClick={add}>add</Button>
          </>
        )}
        {(!stop || stop.kind === 'place') && (
          <button type="button" className="icon-btn" aria-label={stop?.saved ? 'unsave' : 'save'} aria-pressed={!!stop?.saved} disabled={!canEdit} onClick={toggleSave}>
            <Icon name="bookmark" size={20} />
          </button>
        )}
        {maps && <a className="icon-btn" href={maps} target="_blank" rel="noopener noreferrer" aria-label="open in google maps"><Icon name="ext" size={20} /></a>}
      </div>
      {problem && <p className="warn-line">{problem}</p>}
    </section>
  )
}
