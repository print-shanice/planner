import type { Place } from '../../lib/types'
import { hoursOn, useDetails } from '../../lib/google/details'
import { usePlacePhoto } from '../../lib/placePhoto'
import { Pending } from '../../components/Pending'
import { count } from '../../lib/words'

// what's known about a place, under its name on the card: a free photo (wikipedia, else openverse), how it is rated, what it is,
// its hours on the plan's day, and its website
export function PlaceDetails({ place, day }: { place: Place; day: string | null }) {
  const q = useDetails(place.gid)
  // a free photo: wikipedia's, else openverse's (mostly flickr), with its credit; never google's
  const shot = usePlacePhoto(place)
  const photo = shot.src && <>
    <img className="place-photo" src={shot.src} alt={place.name} loading="lazy" />
    {shot.credit && <a className="place-photo-credit" href={shot.credit.href} target="_blank" rel="noopener noreferrer">photo · {shot.credit.label}</a>}
  </>
  if (!q.enabled && !q.data) return photo ? <div className="place-details">{photo}</div> : null
  if (q.isPending) return <p className="place-details"><Pending label="asking google" /></p>
  const d = q.data
  if (!d) return photo ? <div className="place-details">{photo}</div> : null
  const line = [
    d.rating != null ? `★ ${d.rating.toFixed(1)}` : null,
    d.ratings != null && d.rating != null ? count(d.ratings, 'review') : null,
    d.kind,
  ].filter(Boolean).join(' · ')
  const hours = hoursOn(d.weekdays, day)
  if (!line && !hours && !photo && !d.website) return null
  return (
    <div className="place-details">
      {photo}
      <div className="place-details-words">
        {line && <p className="place-rating num">{line}</p>}
        {hours && <p className="muted num">{hours}</p>}
        {d.website && <a className="text-link" href={d.website} target="_blank" rel="noopener noreferrer">website</a>}
      </div>
    </div>
  )
}
