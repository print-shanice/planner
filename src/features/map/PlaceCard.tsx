import { useState } from 'react'
import type { Place, Stop, Trip } from '../../lib/types'
import { useSave, useStops, useTrips } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { fmtDay, tripDays } from '../../lib/dates'
import { gmapsUrl } from '../../lib/gmaps'
import { asCategory, categoryOf } from '../../lib/categories'
import { scheduleChange } from '../../lib/schedule'
import { Button } from '../../components/Button'
import { Pending } from '../../components/Pending'
import { useStopSheet } from '../stops/StopSheet'
import { stopSub, stopTitle } from '../plan/StopRow'
import { Chip } from '../itinerary/ItinLine'
import { saveError } from '../../lib/errors'

// looking: a tap on the map is still being turned into a place name
type Props = { trip: Trip; place: Place; stop?: Stop; day?: string | null; defaultDay?: string | null; looking?: boolean; onClose: () => void; onDone?: () => void }

const short = (d: string) => fmtDay(d, { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '')

// a picked pin or a found place: what it is, and the three things you'd do with it: look, plan it, go there
export function PlaceCard({ trip, place, stop, day: opened, defaultDay, looking, onClose, onDone }: Props) {
  const stops = useStops().data ?? []
  const trips = useTrips().data ?? []
  const save = useSave('stops')
  const canEdit = useCanEdit()
  const sheet = useStopSheet()
  // an idea is planned into the trip it belongs to
  const home = (stop && trips.find((t) => t.id === stop.trip_id)) || trip
  const idea = !!stop && !stop.day
  const days = tripDays(home)
  const [day, setDay] = useState<string>(defaultDay && days.includes(defaultDay) ? defaultDay : '')
  const [problem, setProblem] = useState<string | null>(null)
  const title = stop ? stopTitle(stop) : place.name || 'dropped pin'
  const maps = gmapsUrl(stop ?? ({ kind: 'place', place } as Stop))
  const fake = { kind: 'place', category: stop?.category ?? place.category ?? null } as Stop
  const sub = stop
    ? [stop.day ? short(stop.day) : 'idea', stopSub(stop)].filter(Boolean).join(' · ')
    : [categoryOf(fake) === 'place' ? '' : categoryOf(fake), place.address].filter(Boolean).join(' · ')

  async function run(fn: () => Promise<unknown>) {
    setProblem(null)
    try { await fn(); onDone?.() } catch (e) { setProblem(saveError(e)) }
  }
  const lastOn = (d: string | null) => Math.max(-1, ...stops.filter((s) => s.trip_id === trip.id && (s.day ?? null) === d).map((s) => s.position)) + 1
  // a new place: kept as an idea, or put straight on the chosen day; its kind comes from the search
  const keep = (d: string | null) => run(() => {
    const { category, ...bare } = place
    return save.mutateAsync({ trip_id: trip.id, kind: 'place', title: place.name || 'dropped pin', day: d, position: lastOn(d), place: bare, status: 'idea', saved: !d, category: asCategory(category) })
  })

  return (
    <section className="place-card" aria-label={looking ? 'finding the place' : title}>
      <div className="place-card-head">
        {stop && <Chip stop={stop} quiet={idea} />}
        <div className="stack-xs place-card-words">
          {looking ? <h3 className="head"><Pending label="finding the place" /></h3> : <h3 className="head">{title}</h3>}
          {sub && <p className="muted">{sub}</p>}
        </div>
        <button type="button" className="text-link" onClick={onClose}>close</button>
      </div>
      {!looking && (
        <div className="place-card-actions">
          {stop && <Button variant={idea ? 'ghost' : 'primary'} onClick={() => sheet?.openStop(stop.id, opened)}>details</Button>}
          {canEdit && (!stop || idea) && (days.length ? (
            <select className="input day-select" aria-label="day" value={day} onChange={(e) => setDay(e.target.value)}>
              <option value="">{stop ? 'pick a day' : 'no date'}</option>
              {days.map((d) => <option key={d} value={d}>{short(d)}</option>)}
            </select>
          ) : (
            <input className="input day-select" type="date" aria-label="day" value={day} onChange={(e) => setDay(e.target.value)} />
          ))}
          {canEdit && !stop && <Button variant="primary" onClick={() => keep(day || null)}>{day ? 'add' : 'save idea'}</Button>}
          {canEdit && idea && <Button variant="primary" disabled={!day} onClick={() => run(() => save.mutateAsync(scheduleChange(stop!, day, stops)))}>add</Button>}
          {maps && <a className="text-link" href={maps} target="_blank" rel="noopener noreferrer">google maps →</a>}
        </div>
      )}
      {problem && <p className="warn-line">{problem}</p>}
    </section>
  )
}
