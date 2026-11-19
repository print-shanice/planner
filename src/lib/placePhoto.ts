import { useQuery } from '@tanstack/react-query'
import type { Place } from './types'
import { useOnline } from './offline'
import { hasPoint } from './walk'
import { wikiPhoto } from './wiki'
import { openversePhoto } from './openverse'

// a place's one photo, from free sources only (never google): wikipedia's page photo for sights and famous places,
// else an open licence photo from openverse (mostly flickr) for cafés, restaurants and shops, else none.
// each is credited ("photo · wikimedia", "photo · flickr") and remembered for 30 days
export type PlacePhoto = { src: string | null; credit: { label: string; href: string } | null; waiting: boolean }

const KEEP = 30 * 24 * 60 * 60 * 1000
const keep = { staleTime: KEEP, gcTime: KEEP, retry: 0 } as const

export function usePlacePhoto(place: Place | null | undefined): PlacePhoto {
  const online = useOnline()
  const named = !!place && !!place.name?.trim() && online
  const wiki = useQuery({
    queryKey: ['wikiphoto', place?.name, place?.lat, place?.lng],
    queryFn: () => wikiPhoto(place!),
    enabled: named && hasPoint(place),
    ...keep,
  })
  // openverse once wikipedia has nothing (or can't be asked: no spot yet)
  const wikiDone = !hasPoint(place) || wiki.isSuccess || wiki.isError
  const verse = useQuery({
    queryKey: ['openverse', place?.name, place?.city ?? null],
    queryFn: () => openversePhoto(place!),
    enabled: named && wikiDone && !wiki.data,
    ...keep,
  })
  if (named && wiki.data) return { src: wiki.data.src, credit: { label: 'wikimedia', href: wiki.data.page }, waiting: false }
  if (named && verse.data) return { src: verse.data.src, credit: { label: verse.data.source, href: verse.data.page }, waiting: false }
  return { src: null, credit: null, waiting: named && (wiki.isLoading || verse.isLoading) }
}
