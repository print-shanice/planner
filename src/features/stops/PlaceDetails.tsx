import type { Place } from '../../lib/types'
import { hoursOn, useDetails } from '../../lib/google/details'
import { Pending } from '../../components/Pending'

// what google says about a place, under its name on the card: its photo, how it is rated, what it is,
// its hours on the plan's day, and its website. compact: no photo (the map's small card)
export function PlaceDetails({ place, day, compact = false }: { place: Place; day: string | null; compact?: boolean }) {
  const q = useDetails(place.gid)
  if (!q.enabled && !q.data) return null
  if (q.isPending) return <p className="place-details"><Pending label="asking google" /></p>
  const d = q.data
  if (!d) return null
  const line = [
    d.rating != null ? `★ ${d.rating.toFixed(1)}` : null,
    d.ratings != null && d.rating != null ? `${d.ratings.toLocaleString('en-GB')} ${d.ratings === 1 ? 'review' : 'reviews'}` : null,
    d.kind,
  ].filter(Boolean).join(' · ')
  const hours = hoursOn(d.weekdays, day)
  if (!line && !hours && !d.photo && !d.website) return null
  return (
    <div className={`place-details${compact ? ' compact' : ''}`}>
      {!compact && d.photo && <img className="place-photo" src={d.photo} alt={place.name} loading="lazy" />}
      <div className="place-details-words">
        {line && <p className="place-rating num">{line}</p>}
        {hours && <p className="muted num">{hours}</p>}
        {d.website && !compact && <a className="text-link" href={d.website} target="_blank" rel="noopener noreferrer">website →</a>}
      </div>
    </div>
  )
}
