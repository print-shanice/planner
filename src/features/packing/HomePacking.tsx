import { useSearchParams } from 'react-router-dom'
import type { Trip } from '../../lib/types'
import { countdown, fmtRange, todayISO } from '../../lib/dates'
import { hasPoint } from '../../lib/walk'
import { packWeatherAsk, useTemps, weatherLine } from '../../lib/weather'
import { colourVar } from '../../lib/colors'
import { EmptyState } from '../../components/EmptyState'
import { ChoiceMenu, type Choice } from '../../components/ChoiceMenu'
import { tripChoices } from '../home/Inbox'
import { leadTrip, when } from '../home/Trips'
import { PackingTab } from './PackingTab'

// packing is for one trip at a time: the one on now or coming next, unless another is picked (kept in the address).
// one line names it, "packing for <trip>" with the trip's colour before its name, and the name opens a menu of the trips coming up, then the past ones
export function HomePacking({ trips }: { trips: Trip[] }) {
  const [params, setParams] = useSearchParams()
  const today = todayISO()
  const byId = new Map(trips.map((t) => [t.id, t]))
  const asked = byId.get(params.get('trip') ?? '')
  const trip = asked ?? leadTrip(trips, today) ?? trips.filter((t) => !t.parent_id)[0] ?? trips[0]
  // the trip's main place only: a side trip's weather isn't its parent's
  const base = trip?.base
  const at = hasPoint(base) ? { lat: base.lat, lng: base.lng } : null
  const temps = useTemps(at, trip ? packWeatherAsk(trip.start_date, trip.end_date, today) : null).data
  if (!trip) return <EmptyState title="no trips yet" />

  const ended = (t: Trip) => countdown(t, today).kind === 'done'
  // in the schedule's order (coming up by date, then past newest first), side trips under their trip and in its section
  let section = 'coming up'
  const choices: Choice[] = tripChoices(trips, today).map((c) => {
    const t = byId.get(c.value)
    if (!c.depth && t) section = ended(t) ? 'past' : 'coming up'
    return { ...c, section }
  })
  const coming = choices.map((c) => byId.get(c.value)).filter((t): t is Trip => !!t && !ended(t))
  const pick = (id: string) => setParams((p) => { const n = new URLSearchParams(p); n.set('trip', id); return n }, { replace: true })
  const dates = [fmtRange(trip.start_date, trip.end_date), when(trip, today)].filter(Boolean).join(' · ')

  return (
    <div className="home-packing">
      <p className="pack-for">
        packing for <ChoiceMenu label={<><span className="pack-swatch" style={{ background: colourVar(trip.color) }} aria-hidden="true" />{trip.name.toLowerCase()}</>} ariaLabel="packing for which trip" options={choices} selected={trip.id} align="left" onPick={pick} className="pack-for-pick" />
      </p>
      <PackingTab key={trip.id} trip={trip} dates={dates} weather={temps ? weatherLine(temps) : null}
        copyTo={coming.filter((t) => t.id !== trip.id)} />
    </div>
  )
}
