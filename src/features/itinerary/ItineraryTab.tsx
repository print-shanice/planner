import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import type { Stop, Trip } from '../../lib/types'
import { useStops, useTrips } from '../../lib/queries'
import { loadState } from '../../lib/load'
import { todayISO, type DayEntry } from '../../lib/dates'
import { chosenDay, validDay } from '../../lib/agenda'
import { dayAreas, findMatches, itineraryDays, normal, type ItinDay } from '../../lib/itinerary'
import { LoadState } from '../../components/States'
import { Icon } from '../../components/Icon'
import { dayLabel, tint } from '../../components/MonthCalendar'
import { fmtDay } from '../../lib/dates'
import { useStopSheet } from '../stops/StopSheet'
import { useHighlight } from '../trip/highlight'
import { useReadingDay } from '../trip/readingDay'
import { ItinLine } from './ItinLine'
import { AddLine } from './AddLine'

const foldKey = (id: string) => `itinerary-folded-${id}`
function readFolds(id: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(foldKey(id)) ?? '[]') as string[]) } catch { return new Set() }
}
function writeFolds(id: string, s: Set<string>) {
  try { localStorage.setItem(foldKey(id), JSON.stringify([...s])) } catch { /* no storage: folds last this visit only */ }
}

const counted = (e: DayEntry) => e.kind === 'stop' || e.kind === 'checkin'

// the sticky bar's height, so a day or a match lands just under it
function underBar(root: HTMLElement | null) {
  const bar = document.querySelector<HTMLElement>('.trip-bar')
  root?.style.setProperty('--bar-h', `${bar?.offsetHeight ?? 0}px`)
}

type Props = { trip: Trip; slot?: HTMLElement | null }

// the whole trip as one doc: every day folds, and search finds every line a place is on
export const ItineraryTab = memo(function ItineraryTab({ trip, slot }: Props) {
  const tq = useTrips()
  const sq = useStops()
  const trips = tq.data ?? []
  const stops = sq.data ?? []
  const load = loadState(tq, sq)
  const sheet = useStopSheet()
  const lit = useHighlight()
  const [params] = useSearchParams()
  const reading = useReadingDay()
  const root = useRef<HTMLDivElement>(null)
  const strip = useRef<HTMLElement>(null)

  const it = useMemo(() => itineraryDays(trip, trips, stops), [trip, trips, stops])
  const [folded, setFolded] = useState(() => readFolds(trip.id))
  const [q, setQ] = useState('')
  const [cur, setCur] = useState(0)
  // days opened by hand while searching; forgotten when the search changes
  const [peek, setPeek] = useState<Set<string>>(new Set())
  const searching = normal(q.trim()) !== ''
  const matches = useMemo(() => findMatches(it, q), [it, q])
  const hitDays = useMemo(() => new Set(matches.map((m) => m.date ?? 'none')), [matches])
  const current = matches[cur] ?? null

  const asked = params.get('day')
  // where the doc opens: the calendar's day, else today in the trip, else its first day
  const opensOn = validDay(asked) ? asked : chosenDay(trip, trips, stops, null, todayISO())
  const onDay = reading.day ?? it.days.find((d) => d.date >= (opensOn ?? ''))?.date ?? it.days[0]?.date ?? null
  const readingRef = useRef(reading)
  readingRef.current = reading
  function setDay(d: string | null) {
    if (d && d !== readingRef.current.day) readingRef.current.set(d)
  }
  // leaving the itinerary, the map and the + go back to the calendar's day
  useEffect(() => () => readingRef.current.set(null), [])

  function scrollTo(el: Element | null | undefined, block: ScrollLogicalPosition) {
    underBar(root.current)
    el?.scrollIntoView?.({ behavior: 'smooth', block })
  }

  function jumpDay(d: string) {
    setDay(d)
    scrollTo(document.getElementById(`itin-${d}`), 'start')
  }

  function goMatch(i: number) {
    if (!matches.length) return
    const n = (i + matches.length) % matches.length
    setCur(n)
    const m = matches[n]
    if (m.date) setDay(m.date)
  }

  // a new search starts at its first match
  useEffect(() => {
    setCur(0)
    setPeek(new Set())
    if (matches[0]?.date) setDay(matches[0].date)
  }, [q]) // eslint-disable-line react-hooks/exhaustive-deps

  // the current match comes into view once its day has opened
  useEffect(() => {
    if (current) scrollTo(document.querySelector(`[data-line="${current.id}"]`), 'center')
  }, [current?.id, cur]) // eslint-disable-line react-hooks/exhaustive-deps

  // opening the doc lands on the day you're on
  const landed = useRef(false)
  useEffect(() => {
    if (landed.current || load.state !== 'ready' || !it.days.length) return
    landed.current = true
    const target = it.days.find((d) => d.date >= (opensOn ?? ''))?.date
    if (!target || target === it.days[0].date) return
    // once the search and the strip have moved into the bar, so the day lands just under it
    const land = () => { underBar(root.current); document.getElementById(`itin-${target}`)?.scrollIntoView?.({ block: 'start' }) }
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(land))
    else land()
  }, [load.state, it.days.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // the day nearest the top is the day you're on: the map, the + and the calendar follow it
  useEffect(() => {
    const scroller = root.current?.closest<HTMLElement>('.trip-wide .trip-main') ?? null
    const target: HTMLElement | Window = scroller ?? window
    let frame = 0
    const check = () => {
      frame = 0
      const top = (document.querySelector('.trip-bar')?.getBoundingClientRect().bottom ?? 0) + 12
      let at: string | null = null
      for (const el of root.current?.querySelectorAll<HTMLElement>('.itin-day[data-date]') ?? []) {
        if (el.getBoundingClientRect().top <= top) at = el.dataset.date ?? null
        else break
      }
      if (at) setDay(at)
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(check) }
    target.addEventListener('scroll', onScroll, { passive: true })
    return () => { target.removeEventListener('scroll', onScroll); if (frame) cancelAnimationFrame(frame) }
  }) // re-attaches each render so it reads the latest link

  // the strip only moves when the day you're on has gone out of sight, and then glides just far enough
  useEffect(() => {
    const box = strip.current
    const chip = box?.querySelector<HTMLElement>('[aria-current="true"]')
    if (!box || !chip || typeof box.scrollTo !== 'function') return
    const pad = 16
    const left = chip.getBoundingClientRect().left - box.getBoundingClientRect().left + box.scrollLeft
    const right = left + chip.offsetWidth
    if (left < box.scrollLeft + pad) box.scrollTo({ left: left - pad, behavior: 'smooth' })
    else if (right > box.scrollLeft + box.clientWidth - pad) box.scrollTo({ left: right - box.clientWidth + pad, behavior: 'smooth' })
  }, [onDay])

  if (load.state !== 'ready' && !it.days.length) return <LoadState load={load} blocks={2} />

  const isOpen = (key: string) => (searching ? hitDays.has(key) || peek.has(key) : !folded.has(key))
  function toggle(key: string) {
    if (searching) {
      setPeek((p) => { const n = new Set(p); if (n.has(key)) n.delete(key); else n.add(key); return n })
      return
    }
    setFolded((f) => {
      const n = new Set(f)
      if (n.has(key)) n.delete(key); else n.add(key)
      writeFolds(trip.id, n)
      return n
    })
  }
  const onOpen = sheet ? (s: Stop) => sheet.openStop(s.id) : undefined

  const tools = (
    <div className="itin-tools">
      <div className="itin-search">
        <label className="search-box">
          <Icon name="search" size={18} />
          <input type="search" role="searchbox" aria-label="search the itinerary" placeholder="search" value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); goMatch(cur + (e.shiftKey ? -1 : 1)) } }} />
          {searching && <span className="muted num match-count" data-testid="match-count">{matches.length ? `${cur + 1} of ${matches.length}` : '0'}</span>}
        </label>
        {searching && <>
          <button type="button" className="icon-btn" aria-label="previous match" disabled={!matches.length} onClick={() => goMatch(cur - 1)}><Icon name="up" size={18} /></button>
          <button type="button" className="icon-btn" aria-label="next match" disabled={!matches.length} onClick={() => goMatch(cur + 1)}><Icon name="down" size={18} /></button>
        </>}
      </div>
      {it.days.length > 0 && (
        <nav className="chips itin-strip" aria-label="days" ref={strip}>
          {it.days.map((d) => (
            <button key={d.date} type="button" className={`chip${searching && hitDays.has(d.date) ? ' hit' : ''}`} aria-label={dayLabel(d.date)}
              aria-current={onDay === d.date ? 'true' : undefined} onClick={() => jumpDay(d.date)}>
              <span className="muted">{fmtDay(d.date, { weekday: 'short' })}</span>
              <span className="num">{+d.date.slice(8)}</span>
              <span className="muted">{fmtDay(d.date, { month: 'short' })}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  )

  return (
    <div className="itin" ref={root}>
      {slot ? createPortal(tools, slot) : tools}
      <LoadState load={load} />
      {it.days.map((d) => (
        <Day key={d.date} day={d} trip={trip} open={isOpen(d.date)} onToggle={() => toggle(d.date)}
          q={searching ? q : ''} current={current?.id ?? null} onOpen={onOpen} onLight={lit.set} />
      ))}
      {it.undated.length > 0 && (
        <section className="itin-day" aria-label="no date">
          <h3 className="itin-head">
            <button type="button" aria-expanded={isOpen('none')} onClick={() => toggle('none')}>
              <Icon name="chevron" size={16} /><span className="itin-date">no date</span>
              <span className="itin-count muted num">{it.undated.length}</span>
            </button>
          </h3>
          {isOpen('none') && <div className="itin-lines">
            {it.undated.map((s) => <ItinLine key={s.id} entry={{ kind: 'stop', stop: s }} any={false} q={searching ? q : ''} current={current?.id === s.id} onOpen={onOpen} onLight={lit.set} />)}
            <AddLine trip={trip} day={null} />
          </div>}
        </section>
      )}
    </div>
  )
})

type DayProps = {
  day: ItinDay
  trip: Trip
  open: boolean
  onToggle: () => void
  q: string
  current: string | null
  onOpen?: (s: Stop) => void
  onLight: (id: string | null) => void
}

function Day({ day, trip, open, onToggle, q, current, onOpen, onLight }: DayProps) {
  const areas = dayAreas(day.entries)
  const side = day.owner.id !== trip.id ? day.owner : null
  const timed = day.entries.some((e) => e.kind === 'stop' && e.stop?.time)
  return (
    <section className="itin-day" id={`itin-${day.date}`} data-date={day.date} data-testid={`itin-${day.date}`} style={side ? tint(side.color) : undefined}>
      <h3 className="itin-head">
        <button type="button" aria-expanded={open} onClick={onToggle}>
          <Icon name="chevron" size={16} />
          {side && <span className="itin-side"><span className="dot" />{side.name}</span>}
          <span className="itin-date">{dayLabel(day.date)}</span>
          <span className="itin-areas muted">{areas.slice(0, 3).join(' · ')}</span>
          <span className="itin-count muted num">{day.entries.filter(counted).length || ''}</span>
        </button>
      </h3>
      {open && (
        <div className="itin-lines">
          {day.entries.map((e) => (
            <ItinLine key={`${e.stop!.id}-${e.kind}`} entry={e} any={timed && e.kind === 'stop'} q={q}
              current={current === e.stop!.id && e.kind !== 'staying' && e.kind !== 'checkout'} onOpen={onOpen} onLight={onLight} />
          ))}
          <AddLine trip={day.owner} day={day.date} />
        </div>
      )}
    </section>
  )
}
