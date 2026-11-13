import type { Link, Stop, Trip } from './types'
import { descendants } from './countries'
import { normal } from './itinerary'
import { hostOf } from './embed'
import { stopTitle } from '../features/plan/stopText'
import { dayEntries } from './agenda'

// one thing written down: a note line, the notes on a place, stay or journey, or a link's note
export type NoteItem = {
  key: string
  kind: 'note' | 'stop' | 'link'
  // what it's on (a note line's own title)
  title: string
  text: string
  date: string | null
  stop?: Stop
  link?: Link
}
export type TripNotes = { undated: NoteItem[]; days: { date: string; items: NoteItem[] }[] }

const has = (q: string, ...xs: (string | null | undefined)[]) => !q || xs.some((x) => !!x && normal(x).includes(q))

// everything written down across a trip and its side trips, the way the trip reads: no date first, then day by day
export function tripNotes(trip: Trip, trips: Trip[], stops: Stop[], links: Link[], query = ''): TripNotes {
  const ids = new Set(descendants(trip.id, trips))
  const q = normal(query.trim())
  const mine = stops.filter((s) => ids.has(s.trip_id))
  // a row just added hasn't come back from the server yet, so its notes may be missing
  const words = (s: Stop) => s.notes ?? ''
  const written = mine.filter((s) => (s.kind === 'note' ? !!((s.title ?? '').trim() || words(s).trim()) : !!words(s).trim()))
  const byStop = new Map<string, NoteItem[]>()
  const looseLinks: NoteItem[] = []
  for (const l of links) {
    if (!l.trip_id || !ids.has(l.trip_id) || !(l.note ?? '').trim()) continue
    const on = mine.find((s) => s.id === l.stop_id)
    const item: NoteItem = { key: `link:${l.id}`, kind: 'link', title: (l.title ?? '').trim() || hostOf(l.url), text: l.note, date: on?.day ?? null, link: l }
    if (!has(q, item.title, item.text, l.url)) continue
    if (on) byStop.set(on.id, [...(byStop.get(on.id) ?? []), item])
    else looseLinks.push(item)
  }
  const stopItem = (s: Stop): NoteItem =>
    s.kind === 'note'
      ? { key: `stop:${s.id}`, kind: 'note', title: s.title ?? '', text: words(s), date: s.day ?? null, stop: s }
      : { key: `stop:${s.id}`, kind: 'stop', title: stopTitle(s), text: words(s), date: s.day ?? null, stop: s }
  const shows = (s: Stop) => written.includes(s) && has(q, s.title, s.notes, s.place?.name, s.place?.city, s.place?.area, s.origin?.name, s.destination?.name)
  // lines in the plan's order; a link's note follows the place it's for, even when that place has none
  const lines = (ss: Stop[]) => ss.flatMap((s) => [...(shows(s) ? [stopItem(s)] : []), ...(byStop.get(s.id) ?? [])])

  const undated = [
    ...lines(mine.filter((s) => !s.day).sort((a, b) => a.position - b.position || a.title.localeCompare(b.title))),
    ...looseLinks.sort((a, b) => (b.link!.created_at ?? '').localeCompare(a.link!.created_at ?? '')),
  ]
  const dates = [...new Set(mine.filter((s) => s.day).map((s) => s.day!))].sort()
  // a day as the plan reads it (times decide, an untimed check-in ends it); a stay's notes sit on its check-in day only
  const onDay = (date: string) => dayEntries(trip, trips, mine, date).filter((e) => (e.kind === 'stop' || e.kind === 'checkin') && e.stop).map((e) => e.stop!)
  const days = dates.map((date) => ({ date, items: lines(onDay(date)) })).filter((d) => d.items.length)
  return { undated, days }
}
