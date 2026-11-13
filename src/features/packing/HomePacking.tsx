import { useSearchParams } from 'react-router-dom'
import type { Trip } from '../../lib/types'
import { todayISO } from '../../lib/dates'
import { EmptyState } from '../../components/EmptyState'
import { ChoiceMenu } from '../../components/ChoiceMenu'
import { tripChoices } from '../home/Inbox'
import { leadTrip } from '../home/Trips'
import { PackingTab } from './PackingTab'

// packing is for one trip at a time: the one on now or coming next, unless another is picked (kept in the address)
export function HomePacking({ trips }: { trips: Trip[] }) {
  const [params, setParams] = useSearchParams()
  const today = todayISO()
  const asked = trips.find((t) => t.id === params.get('trip'))
  const trip = asked ?? leadTrip(trips, today) ?? trips.filter((t) => !t.parent_id)[0] ?? trips[0]
  if (!trip) return <EmptyState title="no trips yet" />
  const pick = (id: string) => setParams((p) => { const n = new URLSearchParams(p); n.set('trip', id); return n }, { replace: true })
  return (
    <div className="home-packing">
      <p className="pack-for">
        <span className="mono-label">packing for</span>
        <ChoiceMenu label={trip.name} ariaLabel="packing for which trip" options={tripChoices(trips, today)} onPick={pick} className="pack-trip" />
      </p>
      <PackingTab key={trip.id} trip={trip} />
    </div>
  )
}
