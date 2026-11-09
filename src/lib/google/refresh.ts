import { useEffect, useRef } from 'react'
import type { Place, Stop } from '../types'
import { useSave } from '../queries'
import { useCanEdit } from '../offline'
import { todayISO } from '../dates'
import { googleConfigured } from './config'
import { needsRefresh, refetchPlace } from './places'

const FIELDS = ['place', 'origin', 'destination'] as const
// a handful per visit is plenty for two people, and keeps the requests (and their cost) small
const PER_VISIT = 25

// google lets coordinates be kept 30 days; older ones are asked for again (by place id, which can be kept)
// while the map is open and someone signed in is online
export function useRefreshPlaces(stops: Stop[]): void {
  const save = useSave('stops')
  const canEdit = useCanEdit()
  const done = useRef(new Set<string>())
  useEffect(() => {
    if (!canEdit || !googleConfigured()) return
    const today = todayISO()
    const due = stops.flatMap((s) => FIELDS.filter((f) => needsRefresh(s[f], today) && !done.current.has(`${s.id}:${f}`)).map((f) => ({ s, f })))
    for (const { s, f } of due.slice(0, PER_VISIT - done.current.size)) {
      done.current.add(`${s.id}:${f}`)
      refetchPlace(s[f] as Place, today)
        .then((fresh) => save.mutateAsync({ id: s.id, [f]: fresh }))
        .catch(() => { /* tried once this visit; the old coordinates stay until the next try */ })
    }
  }, [stops, canEdit]) // eslint-disable-line react-hooks/exhaustive-deps
}
