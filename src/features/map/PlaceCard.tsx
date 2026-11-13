import { useRef, useState } from 'react'
import type { Place, Stop, Trip } from '../../lib/types'
import { useCosts } from '../../lib/queries'
import { dayEntries } from '../../lib/agenda'
import { dayAreas } from '../../lib/itinerary'
import { beforeByTime } from '../../lib/move'
import { couldBeTime, readTime } from '../../lib/time'
import { newId } from '../../lib/id'
import { nextPosition } from '../../lib/schedule'
import { useWide } from '../../lib/useWide'
import { Icon } from '../../components/Icon'
import { useMove } from '../itinerary/useMove'
import { useDrag } from '../itinerary/drag'
import { DayMenu, type DayChoice } from './DayMenu'
import { newPlaceStop } from './newStop'
import { useSave, useStops, useTrips } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { dayLabel, tripDays } from '../../lib/dates'
import { gmapsUrl } from '../../lib/gmaps'
import { asCategory, categoryOf } from '../../lib/categories'
import { Button } from '../../components/Button'
import { Pending } from '../../components/Pending'
import { useStopSheet } from '../stops/StopSheet'
import { stopSub, stopTitle } from '../plan/stopText'
import { Chip } from '../itinerary/ItinLine'
import { saveError } from '../../lib/errors'
import { PlaceDetails } from '../stops/PlaceDetails'

// looking: a tap on the map is still being turned into a place name
type Props = { trip: Trip; place: Place; stop?: Stop; day?: string | null; defaultDay?: string | null; looking?: boolean; onClose: () => void; onDone?: () => void }

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
  const [time, setTime] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const timeBox = useRef<HTMLInputElement>(null)
  const go = useRef<HTMLButtonElement>(null)
  const move = useMove(trip)
  const drag = useDrag()
  const wide = useWide()
  const costs = useCosts().data ?? []
  // what each day already holds, under its name in the list: its areas, else its first few lines
  const choices: DayChoice[] = days.map((d) => {
    const entries = dayEntries(trip, trips, stops, d)
    const areas = dayAreas(entries)
    const names = entries.filter((e) => e.kind === 'stop' && e.stop).map((e) => stopTitle(e.stop!).toLowerCase())
    return { date: d, sub: (areas.length ? areas.map((a) => a.toLowerCase()) : names).slice(0, 3).join(' · ') }
  })
  const at = readTime(time) ?? null
  // the line it would be: the idea itself, or a new place
  const row = (): Stop => {
    if (stop) return { ...stop, time: at ?? stop.time }
    return newPlaceStop(place, trip.id, at, fresh.current)
  }
  const fresh = useRef(newId())
  function add() {
    if (!day) { if (!stop) keep(null); return }
    const r = row()
    const ctx = { top: trip, trips, stops, costs }
    move(r, day, beforeByTime(r, day, ctx), { fresh: !stop, said: `added to ${dayLabel(day)}` })
    onDone?.()
  }
  function pickDay(d: string) {
    setDay(d)
    // a day picked: straight on to its time (an idea has no time, so on to the button)
    setTimeout(() => (d ? timeBox.current : go.current)?.focus(), 0)
  }
  const label = !day ? (stop ? 'pick a day' : 'save as an idea') : `add to ${dayLabel(day)}${at ? ` at ${at}` : ''}`
  const title = stop ? stopTitle(stop) : place.name || 'dropped pin'
  const maps = gmapsUrl(stop ?? ({ kind: 'place', place } as Stop))
  const fake = { kind: 'place', category: stop?.category ?? place.category ?? null } as Stop
  const sub = stop
    ? [stop.day ? dayLabel(stop.day) : 'idea', stopSub(stop)].filter(Boolean).join(' · ')
    : [categoryOf(fake) === 'place' ? '' : categoryOf(fake), place.address].filter(Boolean).join(' · ')

  async function run(fn: () => Promise<unknown>) {
    setProblem(null)
    try { await fn(); onDone?.() } catch (e) { setProblem(saveError(e)) }
  }
  // a new place: kept as an idea, or put straight on the chosen day; its kind comes from the search
  const keep = (d: string | null) => run(() => {
    const { category, ...bare } = place
    return save.mutateAsync({ trip_id: trip.id, kind: 'place', title: place.name || 'dropped pin', day: d, position: nextPosition(stops, trip.id, d), place: bare, status: 'idea', saved: !d, category: asCategory(category) })
  })

  return (
    <section className="place-card" aria-label={looking ? 'finding the place' : title}>
      <div className="place-card-head">
        {stop && <Chip stop={stop} quiet={idea} />}
        <div className="stack-xs place-card-words">
          {looking ? <h3 className="head"><Pending label="finding the place" /></h3> : <h3 className="head">{title}</h3>}
          {sub && <p className="muted">{sub}</p>}
          {!looking && place.gid && <PlaceDetails place={place} day={opened ?? stop?.day ?? null} compact />}
        </div>
        <button type="button" className="text-link" onClick={onClose}>close</button>
      </div>
      {!looking && (
        <div className="place-card-actions">
          {stop && <Button variant={idea ? 'ghost' : 'primary'} onClick={() => sheet?.openStop(stop.id, opened)}>details</Button>}
          {canEdit && (!stop || idea) && (
            <div className="place-card-plan">
              <div className="place-card-when">
                <DayMenu days={choices} value={day} onPick={pickDay} />
                {day && <input ref={timeBox} className="input place-card-time" type="text" inputMode="decimal" autoComplete="off" aria-label="time" placeholder="any" value={time}
                  onChange={(e) => { if (couldBeTime(e.target.value)) setTime(e.target.value) }}
                  onBlur={() => { const t = readTime(time); if (t) setTime(t) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} />}
              </div>
              <button ref={go} type="button" className="btn primary" disabled={!day && !!stop} onClick={add}>{label}</button>
              {wide && drag && (
                <div className="place-card-drag" onPointerDown={(e) => {
                  if (e.button !== 0) return
                  e.preventDefault()
                  const r = row()
                  drag.begin(stop ? { kind: 'line', stop: r, label: stopTitle(r).toLowerCase() } : { kind: 'new', stop: r, label: r.title.toLowerCase() }, e)
                }}>
                  <Icon name="more" size={16} /><span>or drag it into the plan, where it goes</span>
                </div>
              )}
            </div>
          )}
          {maps && <a className="text-link" href={maps} target="_blank" rel="noopener noreferrer">google maps →</a>}
        </div>
      )}
      {problem && <p className="warn-line">{problem}</p>}
    </section>
  )
}
