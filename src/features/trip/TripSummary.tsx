import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { Trip } from '../../lib/types'
import { useCosts, useLinks, usePacking, useRates, useStops, useTrips } from '../../lib/queries'
import { descendants } from '../../lib/countries'
import { formatMoney, totals } from '../../lib/money'
import { Icon } from '../../components/Icon'
import type { Tab } from './tabs'

// the trip's sections as small summaries; each one opens its section
export function TripSummary({ trip, sections }: { trip: Trip; sections: Exclude<Tab, 'plan'>[] }) {
  const trips = useTrips().data ?? []
  const costs = useCosts().data ?? []
  const links = useLinks().data ?? []
  const stops = useStops().data ?? []
  const packing = usePacking().data ?? []
  const rates = useRates().data ?? null
  const ids = useMemo(() => new Set(descendants(trip.id, trips)), [trip.id, trips])

  const t = totals(costs.filter((c) => ids.has(c.trip_id)), trip.currency, rates)
  const saved = links.filter((l) => l.trip_id && ids.has(l.trip_id)).length + stops.filter((s) => s.saved && ids.has(s.trip_id)).length
  const items = packing.filter((p) => p.trip_id === trip.id)
  const value: Record<Exclude<Tab, 'plan'>, JSX.Element> = {
    map: <Icon name="map" size={20} />,
    money: <>{formatMoney(t.paid + t.planned, trip.currency)}</>,
    saved: <>{saved}</>,
    packing: <>{items.filter((p) => p.done).length}/{items.length}</>,
  }

  return (
    <nav className="tiles" aria-label="trip sections">
      {sections.map((s) => (
        <Link key={s} to={`?tab=${s}`} className="tile">
          <span className="tile-value num">{value[s]}</span>
          <span className="tile-label">{s}</span>
        </Link>
      ))}
    </nav>
  )
}
