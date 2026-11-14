import { useSearchParams } from 'react-router-dom'
import type { Trip } from '../../lib/types'
import { countdown, fmtRange, todayISO } from '../../lib/dates'
import { colourVar } from '../../lib/colors'
import { hasPoint } from '../../lib/walk'
import { packWeatherAsk, useTemps, weatherLine } from '../../lib/weather'
import { EmptyState } from '../../components/EmptyState'
import { tripChoices } from '../home/Inbox'
import { leadTrip, when } from '../home/Trips'
import { PackingTab } from './PackingTab'

// packing is for one trip at a time: the one on now or coming next, unless another is picked (kept in the address).
// "coming up" and "past" split the trips; the trips themselves are a row of text tabs that scrolls sideways
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
  // in the schedule's order: what's coming up by date, then past trips newest first
  const ordered = tripChoices(trips, today).map((c) => byId.get(c.value)).filter((t): t is Trip => !!t)
  const coming = ordered.filter((t) => !ended(t))
  const past = ordered.filter(ended)
  const shown = ended(trip) ? past : coming
  const pick = (id: string) => setParams((p) => { const n = new URLSearchParams(p); n.set('trip', id); return n }, { replace: true })
  const dates = [fmtRange(trip.start_date, trip.end_date), when(trip, today)].filter(Boolean).join(' · ')

  return (
    <div className="home-packing">
      {past.length > 0 && coming.length > 0 && (
        <div className="pack-tabs" role="tablist" aria-label="which trips">
          <button type="button" role="tab" aria-selected={!ended(trip)} onClick={() => ended(trip) && pick((leadTrip(trips, today) ?? coming[0]).id)}>coming up</button>
          <button type="button" role="tab" aria-selected={ended(trip)} onClick={() => !ended(trip) && pick(past[0].id)}>past</button>
        </div>
      )}
      <div className="pack-trips">
        <div className="pack-tabs small" role="tablist" aria-label="trip">
          {shown.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={t.id === trip.id} onClick={() => pick(t.id)}>
              <span className="pack-swatch" style={{ background: colourVar(t.color) }} aria-hidden="true" />{t.name.toLowerCase()}
            </button>
          ))}
        </div>
      </div>
      <PackingTab key={trip.id} trip={trip} dates={dates} weather={temps ? weatherLine(temps) : null}
        copyTo={coming.filter((t) => t.id !== trip.id)} />
    </div>
  )
}
