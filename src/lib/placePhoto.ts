import { useQuery } from '@tanstack/react-query'
import type { Place } from './types'
import { useDetails } from './google/details'
import { useOnline } from './offline'
import { hasPoint } from './walk'
import { wikiPhoto } from './wiki'

// a place's one photo: google's when it sends one, else wikipedia's (credited), else none.
// wikipedia is only asked once google has answered without a photo (or isn't set up), and is remembered for 30 days
export type PlacePhoto = { src: string | null; credit: { label: string; href: string } | null; waiting: boolean }

const KEEP = 30 * 24 * 60 * 60 * 1000

export function usePlacePhoto(place: Place | null | undefined): PlacePhoto {
  const online = useOnline()
  const google = useDetails(place?.gid)
  const asking = google.enabled && google.isPending
  const fromGoogle = google.data?.photo ?? null
  const ask = !!place && !!place.name?.trim() && hasPoint(place) && online && !asking && !fromGoogle
  const wiki = useQuery({
    queryKey: ['wikiphoto', place?.name, place?.lat, place?.lng],
    queryFn: () => wikiPhoto(place!),
    enabled: ask,
    staleTime: KEEP,
    gcTime: KEEP,
    retry: 0,
  })
  if (fromGoogle) return { src: fromGoogle, credit: null, waiting: false }
  if (ask && wiki.data) return { src: wiki.data.src, credit: { label: 'wikimedia', href: wiki.data.page }, waiting: false }
  return { src: null, credit: null, waiting: asking || (ask && wiki.isLoading) }
}
