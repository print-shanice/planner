import { useRef, useState, type HTMLAttributes, type PointerEvent, type ReactElement } from 'react'
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
import { newPlaceStop } from '../../lib/stops'
import { useSave, useStops, useTrips } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { dayLabel, tripDays } from '../../lib/dates'
import { gmapsUrl } from '../../lib/gmaps'
import { categoryOf } from '../../lib/categories'
import { Pending } from '../../components/Pending'
import { useStopSheet } from '../stops/StopSheet'
import { stopSub, stopTitle } from '../plan/stopText'
import { Chip } from '../itinerary/ItinLine'
import { saveError } from '../../lib/errors'
import { hoursOn, useDetails } from '../../lib/google/details'
import { usePlacePhoto } from '../../lib/placePhoto'
import { count } from '../../lib/words'
import { Tooltip } from '../../components/Tooltip'
import googleMark from '../../assets/google-g.svg'

// looking: a tap on the map is still being turned into a place name
type Props = { trip: Trip; place: Place; stop?: Stop; day?: string | null; defaultDay?: string | null; looking?: boolean; onClose: () => void; onDone?: () => void }

// a picked pin or a found place: a free photo (wikipedia, else openverse), what it is, then plan it (time · day · add) or open it, and go there
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
  // the line it would be added as, for the card's own label and for google's view of it
  const label = !day ? (stop ? 'add to a day' : 'save as an idea') : `add to ${dayLabel(day)}${at ? ` at ${at}` : ''}`
  const title = stop ? stopTitle(stop) : place.name || 'dropped pin'
  const maps = gmapsUrl(stop ?? ({ kind: 'place', place } as Stop))
  const fake = { kind: 'place', category: stop?.category ?? place.category ?? null } as Stop
  // what google says: its word for what it is, reviews, the day's hours and the website
  const google = useDetails(looking ? null : place.gid)
  const d = google.data
  const asking = google.enabled && google.isPending
  // a free photo: wikipedia's, else openverse's (mostly flickr), with its credit; never google's
  const shot = usePlacePhoto(looking ? null : place)
  const photo = shot.src
  const ours = categoryOf(fake) === 'place' ? '' : categoryOf(fake)
  const sub = stop
    ? [stop.day ? dayLabel(stop.day) : 'idea', stopSub(stop)].filter(Boolean).join(' · ')
    : [d?.kind ?? ours, place.address].filter(Boolean).join(' · ')
  const rating = d?.rating != null ? [`★ ${d.rating.toFixed(1)}`, d.ratings != null ? count(d.ratings, 'review') : null].filter(Boolean).join(' · ') : null
  const hours = hoursOn(d?.weekdays, stop?.day || day || opened || null)
  const planning = canEdit && (!stop || idea)
  // on a laptop the photo and the name are what you carry into the plan
  const carry = wide && drag && planning ? (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button, a, input')) return
    e.preventDefault()
    const r = row()
    drag.begin(stop ? { kind: 'line', stop: r, label: stopTitle(r).toLowerCase() } : { kind: 'new', stop: r, label: r.title.toLowerCase() }, e)
  } : undefined
  const handle = (el: ReactElement<HTMLAttributes<HTMLElement>>) => carry ? <Tooltip text="drag into the plan">{el}</Tooltip> : el
  const close = <button type="button" className="icon-btn place-card-x" aria-label="close" onClick={onClose}><Icon name="close" size={18} /></button>
  const top = !looking && (photo || shot.waiting)
  const details = stop && (() => sheet?.openStop(stop.id, opened))

  async function run(fn: () => Promise<unknown>) {
    setProblem(null)
    try { await fn(); onDone?.() } catch (e) { setProblem(saveError(e)) }
  }
  // a new place: kept as an idea, or put straight on the chosen day; its kind comes from the search
  const keep = (d: string | null) => run(() =>
    save.mutateAsync({ ...newPlaceStop(place, trip.id, null, fresh.current), day: d, position: nextPosition(stops, trip.id, d), saved: !d }))

  return (
    <section className={`place-card${top ? ' has-photo' : ''}`} aria-label={looking ? 'finding the place' : title}>
      {/* one ✕, always in the card's corner (on the photo when there is one), so it never moves while a photo is looked for */}
      {close}
      {top && (
        <div className={`place-card-photo${photo ? '' : ' waiting'}`}>
          {photo && handle(<img src={photo} alt={title} className={carry ? 'grab' : undefined} onPointerDown={carry} draggable={false} />)}
        </div>
      )}
      {top && shot.credit && <a className="place-card-credit" href={shot.credit.href} target="_blank" rel="noopener noreferrer">photo · {shot.credit.label}</a>}
      <div className="place-card-head">
        {stop && <Chip stop={stop} quiet={idea} />}
        {handle(
          <div className={`place-card-words${carry ? ' grab' : ''}`} onPointerDown={carry}>
            {looking ? <h3 className="head"><Pending label="finding the place" /></h3> : <h3 className="head">{title}</h3>}
            {sub && <p className="place-card-sub">{sub}</p>}
            {asking && <p className="place-card-fact"><Pending label="asking google" /></p>}
            {rating && <p className="place-card-fact rating">{rating}</p>}
            {hours && <p className="place-card-fact">{hours}</p>}
          </div>,
        )}
      </div>
      {!looking && stop && !idea && (
        <div className="place-card-act"><button type="button" className="btn primary" onClick={details || undefined}>details</button></div>
      )}
      {!looking && planning && (
        <div className="place-card-plan">
          <input ref={timeBox} className="input place-card-time" type="text" inputMode="decimal" autoComplete="off" aria-label="time" placeholder="any" value={time} disabled={!day}
            onChange={(e) => { if (couldBeTime(e.target.value)) setTime(e.target.value) }}
            onBlur={() => { const t = readTime(time); if (t) setTime(t) }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} />
          <DayMenu days={choices} value={day} onPick={pickDay} />
          <button ref={go} type="button" className="btn primary place-card-go" aria-label={label} disabled={!day && !!stop} onClick={add}>{!day && !stop ? 'save' : 'add'}</button>
        </div>
      )}
      {!looking && (idea || maps || d?.website) && (
        <div className="place-card-links">
          {idea && <button type="button" className="btn place-card-link" onClick={details || undefined}>details</button>}
          {maps && <a className="place-card-link" href={maps} target="_blank" rel="noopener noreferrer"><img src={googleMark} alt="" width={16} height={16} /><span>google maps</span></a>}
          {d?.website && <a className="place-card-link" href={d.website} target="_blank" rel="noopener noreferrer"><Icon name="globe" size={16} /><span>website</span></a>}
        </div>
      )}
      {problem && <p className="warn-line">{problem}</p>}
    </section>
  )
}
