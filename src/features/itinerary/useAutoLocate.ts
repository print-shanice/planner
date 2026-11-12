import { useEffect, useRef, useState } from 'react'
import type { Trip } from '../../lib/types'
import { useSave, useStops, useTrips } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { descendants } from '../../lib/countries'
import { biasFor } from '../../lib/guess'
import { hasPoint } from '../../lib/walk'
import { asCategory } from '../../lib/categories'
import { quietFind } from '../../lib/quietFind'
import { setLocating } from '../../lib/locating'

// how many names one visit asks about (each is a google search), and where the ones already asked are remembered
const PER_VISIT = 40
const KEY = 'planner.located'

function tried(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, string> } catch { return {} }
}
function remember(id: string, title: string) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...tried(), [id]: title })) } catch { /* storage unavailable: it may ask again next visit */ }
}

// every place in the trip typed with a name but no spot (on a line, through the +, from an import) is looked up once
// in the background, near where its day happens, and pinned only when the answer plainly matches the name.
// renaming it asks again; anything still unfound keeps its pin+ ("find on the map")
export function useAutoLocate(trip: Trip) {
  const canEdit = useCanEdit()
  const stops = useStops().data
  const trips = useTrips().data ?? []
  const save = useSave('stops')
  const running = useRef(false)
  const asked = useRef(0)
  // a round that ends looks again, for lines added while it ran
  const [round, setRound] = useState(0)
  useEffect(() => {
    if (!canEdit || !stops || running.current || asked.current >= PER_VISIT) return
    const family = new Set(descendants(trip.id, trips))
    const done = tried()
    const todo = stops
      .filter((s) => family.has(s.trip_id) && s.kind === 'place' && !hasPoint(s.place) && s.title.trim() && done[s.id] !== s.title.trim())
      .sort((a, b) => (a.day ?? '9999').localeCompare(b.day ?? '9999'))
      .slice(0, PER_VISIT - asked.current)
    if (!todo.length) return
    running.current = true
    void (async () => {
      for (const s of todo) {
        const title = s.title.trim()
        asked.current += 1
        remember(s.id, title)
        setLocating(s.id, true)
        try {
          const own = trips.find((t) => t.id === s.trip_id) ?? trip
          const p = await quietFind(title, biasFor(own, trips, stops, s.day))
          if (p) {
            const { category, ...bare } = p
            save.mutate({ id: s.id, place: bare, ...(s.category ? {} : { category: asCategory(category) }) })
          }
        } catch { /* not found this time: its pin+ still finds it by hand */ } finally {
          setLocating(s.id, false)
        }
      }
      running.current = false
      setRound((n) => n + 1)
    })()
  }, [stops, canEdit, trip.id, round]) // eslint-disable-line react-hooks/exhaustive-deps
}
