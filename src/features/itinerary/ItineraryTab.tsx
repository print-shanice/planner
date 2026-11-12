import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { createPortal } from 'react-dom'
import type { Stop, Trip } from '../../lib/types'
import { useCosts, useFiles, useLinks, useStops, useTrips } from '../../lib/queries'
import { lineInfo, type LineInfo } from '../../lib/lineInfo'
import { loadState } from '../../lib/load'
import { daysBetween, fmtDay, fmtRange, todayISO } from '../../lib/dates'
import { chosenDay, validDay } from '../../lib/agenda'
import { dayAreas, findMatches, foldsSideTrips, itineraryDays, normal, overviewItems, type ItinDay, type OverviewItem, type SideRow } from '../../lib/itinerary'
import { dayLegs, placeIn, type Leg } from '../../lib/legs'
import { pinNumbers } from '../../lib/pins'
import { useMove } from './useMove'
import { useDrag } from './drag'
import { stopTitle } from '../plan/StopRow'
import { directionsUrl } from '../../lib/gmaps'
import { walkWords } from '../../lib/google/routes'
import { LoadState } from '../../components/States'
import { EmptyState } from '../../components/EmptyState'
import { Icon } from '../../components/Icon'
import { Tooltip } from '../../components/Tooltip'
import { tint } from '../../components/MonthCalendar'
import { useStopSheet } from '../stops/StopSheet'
import { useHighlight } from '../trip/highlight'
import { useReadingDay } from '../trip/readingDay'
import { useWalks, type WalkAnswer } from '../plan/useWalks'
import { ItinLine } from './ItinLine'
import { AddLine } from './AddLine'
import { ParentCalendar } from './ParentCalendar'
import { CountryFlag } from '../../components/CountryFlag'
import { countriesOn, holidaysOn, useHolidays, type Holiday } from '../../lib/holidays'
import { countryName, tripCountries } from '../../lib/countries'
import { useWide } from '../../lib/useWide'
import { clashPairs, type Clash } from '../../lib/clash'
import { descendants } from '../../lib/countries'
import { ClashRow } from '../trip/ClashRow'
import { Sheet } from '../../components/Sheet'
import { TripForm } from '../home/TripForm'
import { useCanEdit } from '../../lib/offline'

// only a fixed or sticky bar covers a scrolled day
function coveredTop() {
  let bottom = 0
  for (const el of document.querySelectorAll<HTMLElement>('.trip-bar, .doc-tools')) {
    const pos = getComputedStyle(el).position
    if (pos === 'sticky' || pos === 'fixed') bottom = Math.max(bottom, el.getBoundingClientRect().bottom)
  }
  return Math.max(0, bottom)
}
function underBar(root: HTMLElement | null) {
  root?.style.setProperty('--bar-h', `${coveredTop()}px`)
}

// how long a line is held still before it's picked up
const HOLD = 300

const monthOf = (d: string) => fmtDay(d, { month: 'long' })

// the whole trip as one document: every listed day open, its lines, the walks between them.
// a long trip lists only days with something on them (and today while it's on)
// searchSlot: where the trip page wants the search button (its header, beside the +); without one it sits above the strip
export const ItineraryTab = memo(function ItineraryTab({ trip, searchSlot }: { trip: Trip; searchSlot?: HTMLElement | null }) {
  const wide = useWide()
  const canEdit = useCanEdit()
  const tq = useTrips()
  const sq = useStops()
  const trips = tq.data ?? []
  const stops = sq.data ?? []
  const files = useFiles().data ?? []
  const costs = useCosts().data ?? []
  const links = useLinks().data ?? []
  const load = loadState(tq, sq)
  const sheet = useStopSheet()
  const lit = useHighlight()
  const [params] = useSearchParams()
  const reading = useReadingDay()
  const root = useRef<HTMLDivElement>(null)
  const strip = useRef<HTMLElement>(null)
  const today = todayISO()
  // public holidays in the countries the trip goes to, for the days it covers
  // the countries come from where the trips are based and where their plans are, never a guess from a name
  const flagsOf = (t: Trip) => tripCountries(t, trips, stops)
  const holidayDays = useHolidays(flagsOf(trip), trip.start_date, trip.end_date ?? trip.start_date)
  const holidaysFor = (date: string) => holidaysOn(holidayDays, date, countriesOn(trip, trips, stops, date, flagsOf))

  const it = useMemo(() => itineraryDays(trip, trips, stops, today), [trip, trips, stops, today])
  const [searching, setSearching] = useState(false)
  const [q, setQ] = useState('')
  const [cur, setCur] = useState(0)
  const query = searching ? q : ''
  // a long trip with side trips is an overview (one row per side trip); searching always looks through everything
  const fold = foldsSideTrips(trip, trips) && !query
  // folded, the calendar is the way around; the list below is only for a trip that isn't
  const items: OverviewItem[] = useMemo(() => fold ? [] : it.days.map((day) => ({ kind: 'day' as const, day })), [fold, it])
  const dateOf = (i: OverviewItem) => (i.kind === 'side' ? i.date : i.day.date)
  const matches = useMemo(() => findMatches({ ...it, undated: [] }, query), [it, query])
  const hitDays = useMemo(() => new Set(matches.map((m) => m.date ?? '')), [matches])
  const current = matches[cur] ?? null
  // a clash shows on every trip it touches, and on the trips above them
  const clashes = useMemo(() => {
    const ids = new Set(descendants(trip.id, trips))
    return clashPairs(trips, stops).filter((c) => ids.has(c.a.tripId) || ids.has(c.b.tripId))
  }, [trips, stops, trip.id])
  const [adjusting, setAdjusting] = useState<Trip | null>(null)
  const adjust = (c: Clash) => { if (c.kind === 'stay') sheet?.editStop(c.b.id); else setAdjusting(trips.find((t) => t.id === c.b.id) ?? null) }
  // what each line holds beyond its name, worked out once for the whole plan
  const infoOf = useMemo(() => {
    const count = new Map<string, number>()
    for (const f of files) count.set(f.stop_id, (count.get(f.stop_id) ?? 0) + 1)
    const made = new Map<string, LineInfo>()
    return (s: Stop) => {
      let info = made.get(s.id)
      if (!info) {
        info = lineInfo(s, { files: count.get(s.id) ?? 0, costs: costs.filter((c) => c.stop_id === s.id), links: links.filter((l) => l.stop_id === s.id) })
        made.set(s.id, info)
      }
      return info
    }
  }, [files, costs, links, stops])

  const asked = params.get('day')
  // where the document opens: the link's day, else today in the trip, else its first day
  const opensOn = validDay(asked) ? asked : chosenDay(trip, trips, stops, null, today)
  const onDay = reading.day ?? items.map(dateOf).find((d) => d >= (opensOn ?? '')) ?? (items[0] ? dateOf(items[0]) : null)
  const readingRef = useRef(reading)
  readingRef.current = reading
  function setDay(d: string | null) {
    if (d && d !== readingRef.current.day) readingRef.current.set(d)
  }
  useEffect(() => () => readingRef.current.set(null), [])

  function scrollTo(el: Element | null | undefined, block: ScrollLogicalPosition, smooth = true) {
    underBar(root.current)
    el?.scrollIntoView?.({ behavior: smooth ? 'smooth' : 'auto', block })
  }
  function jumpDay(d: string) {
    setDay(d)
    scrollTo(document.querySelector(`.doc [data-date="${d}"]`), 'start')
  }
  function goMatch(i: number) {
    if (!matches.length) return
    const n = (i + matches.length) % matches.length
    setCur(n)
    if (matches[n].date) setDay(matches[n].date)
  }
  useEffect(() => { setCur(0); if (matches[0]?.date) setDay(matches[0].date) }, [query]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (current) scrollTo(document.querySelector(`[data-line="${current.id}"]`), 'center') }, [current?.id, cur]) // eslint-disable-line react-hooks/exhaustive-deps

  // opening lands on the day you're on; a laptop/phone switch lands there again
  const landed = useRef(false)
  useLayoutEffect(() => {
    if (landed.current || load.state !== 'ready' || !items.length || fold) return
    landed.current = true
    const target = items.map(dateOf).find((d) => d >= (opensOn ?? ''))
    if (!target || target === dateOf(items[0])) return
    const land = () => scrollTo(document.querySelector(`.doc [data-date="${target}"]`), 'start', false)
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(land))
    else land()
  }, [load.state, items.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const wasWide = useRef(wide)
  useLayoutEffect(() => {
    if (wasWide.current === wide) return
    wasWide.current = wide
    const d = readingRef.current.day
    if (d) requestAnimationFrame?.(() => scrollTo(document.querySelector(`.doc [data-date="${d}"]`), 'start', false))
  }, [wide])

  // the day nearest the top is the day you're reading: the map and the + follow it
  useEffect(() => {
    const scroller = root.current?.closest<HTMLElement>('.trip-wide .trip-main') ?? null
    const target: HTMLElement | Window = scroller ?? window
    let frame = 0
    const check = () => {
      frame = 0
      const top = Math.max(scroller?.getBoundingClientRect().top ?? 0, coveredTop()) + 12
      let at: string | null = null
      for (const el of root.current?.querySelectorAll<HTMLElement>('.doc-day[data-date]') ?? []) {
        if (el.getBoundingClientRect().top <= top) at = el.dataset.date ?? null
        else break
      }
      if (at) setDay(at)
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(check) }
    target.addEventListener('scroll', onScroll, { passive: true })
    // this listener is swapped on every render; a check already waiting for its frame still runs,
    // so something arriving between a scroll and the next frame (holidays, a save) never loses that scroll
    return () => target.removeEventListener('scroll', onScroll)
  })

  // the strip only moves when the day you're on has gone out of sight
  useEffect(() => {
    const box = strip.current
    const chip = box?.querySelector<HTMLElement>('[aria-current="true"]')
    if (!box || !chip || typeof box.scrollTo !== 'function') return
    const left = chip.offsetLeft - 48, right = chip.offsetLeft + chip.offsetWidth + 16
    if (left < box.scrollLeft) box.scrollTo({ left, behavior: 'smooth' })
    else if (right > box.scrollLeft + box.clientWidth) box.scrollTo({ left: right - box.clientWidth, behavior: 'smooth' })
  }, [onDay])

  if (load.state !== 'ready' && !it.days.length) return <LoadState load={load} blocks={2} />
  // where you are (or go next) when the trip is folded: straight into that side trip
  const sideRows = fold ? overviewItems(trip, trips, stops, today).filter((i): i is SideRow => i.kind === 'side') : []
  const sideNow = sideRows.find((i) => i.date <= today && i.end >= today)
  const sideNext = !sideNow ? sideRows.find((i) => i.date > today) : undefined
  const onOpen = sheet ? (s: Stop, day?: string | null) => sheet.openStop(s.id, day) : undefined
  const inTrip = !!trip.start_date && !!trip.end_date && today >= trip.start_date && today <= trip.end_date

  const searchButton = !searching && (
    <button type="button" className="icon-btn" aria-label="search the plan" onClick={() => setSearching(true)}><Icon name="search" size={20} /></button>
  )
  const tools = (
    <div className="doc-tools">
      {!searchSlot && searchButton}
      {searching ? (
        <div className="doc-search">
          <label className="search-box">
            <Icon name="search" size={18} />
            <input type="search" role="searchbox" aria-label="search the plan" placeholder="search the plan" value={q} autoFocus
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); goMatch(cur + (e.shiftKey ? -1 : 1)) } if (e.key === 'Escape') { setSearching(false); setQ('') } }} />
            {normal(q.trim()) && <span className="mono match-count" data-testid="match-count">{matches.length ? `${cur + 1} of ${matches.length}` : '0'}</span>}
          </label>
          <button type="button" className="icon-btn" aria-label="previous match" disabled={!matches.length} onClick={() => goMatch(cur - 1)}><Icon name="up" size={18} /></button>
          <button type="button" className="icon-btn" aria-label="next match" disabled={!matches.length} onClick={() => goMatch(cur + 1)}><Icon name="down" size={18} /></button>
          <button type="button" className="text-link" onClick={() => { setSearching(false); setQ('') }}>done</button>
        </div>
      ) : (
        <div className="doc-strip-row">
          {inTrip && !fold && <button type="button" className="today-chip" aria-label="jump to today" onClick={() => jumpDay(today)}>today</button>}
          {!fold && <nav className="doc-strip" aria-label="days" ref={strip}>
            {items.map((item, i) => {
              const date = dateOf(item)
              const newMonth = i === 0 || monthOf(date) !== monthOf(dateOf(items[i - 1]))
              const month = newMonth && <span className="strip-month" aria-hidden="true">{fmtDay(date, { month: 'short' })}</span>
              if (item.kind === 'side') return null
              const d = item.day
              const side = d.owner.id !== trip.id ? d.owner : null
              return (
                <span key={d.date} className="strip-item">
                  {month}
                  <button type="button" className={`strip-day${side ? ' side' : ''}`} style={side ? tint(side.color) : undefined}
                    data-holiday={holidaysFor(d.date).length ? '' : undefined}
                    aria-label={[fmtDay(d.date, { weekday: 'long', day: 'numeric', month: 'long' }), ...holidaysFor(d.date).map((h) => h.name.toLowerCase())].join(' · ')} aria-current={onDay === d.date ? 'true' : undefined} onClick={() => jumpDay(d.date)}>
                    <span className="strip-wd">{fmtDay(d.date, { weekday: 'narrow' })}</span><span className="strip-n">{+d.date.slice(8)}</span>
                  </button>
                </span>
              )
            })}
          </nav>}
        </div>
      )}
    </div>
  )

  return (
    <div className="doc" ref={root}>
      {searchSlot && searchButton && createPortal(searchButton, searchSlot)}
      {tools}
      <LoadState load={load} />
      {clashes.map((c) => <ClashRow key={`${c.a.id}-${c.b.id}`} clash={c} canEdit={canEdit} onAdjust={adjust} />)}
      {(sideNow || sideNext) && (
        <Link className="side-now" to={`/trip/${(sideNow ?? sideNext)!.trip.id}${sideNow ? `?day=${today}` : ''}`} style={tint((sideNow ?? sideNext)!.trip.color)}>
          <span className="mono-label">{sideNow ? `now · day ${daysBetween(sideNow.date, today) + 1} of ${sideNow.nights + 1}` : `next · in ${daysBetween(today, sideNext!.date)} ${daysBetween(today, sideNext!.date) === 1 ? 'day' : 'days'}`}</span>
          <span className="side-now-name">{(sideNow ?? sideNext)!.trip.name} →</span>
        </Link>
      )}
      {!fold && !items.length && load.state === 'ready' && <EmptyState title="nothing planned yet" />}
      {fold && <ParentCalendar trip={trip} trips={trips} stops={stops} today={today} onDay={setDay} holiday={(d) => holidaysFor(d).map((h) => h.name.toLowerCase()).join(', ') || null}
        renderDay={(d) => <Day key={d.date} day={d} trip={trip} today={today} editing={wide && canEdit} canEdit={canEdit} q="" hidden={false}
          current={null} onOpen={onOpen} onLight={lit.set} infoOf={infoOf} holidays={holidaysFor(d.date)} />} />}
      {items.map((item) => {
        if (item.kind === 'side') return <SideTrip key={`side-${item.trip.id}`} row={item} today={today} />
        const d = item.day
        return <Day key={d.date} day={d} trip={trip} today={today} editing={wide && canEdit} canEdit={canEdit} q={query}
          hidden={!!query && !hitDays.has(d.date)} current={current?.id ?? null} onOpen={onOpen} onLight={lit.set} infoOf={infoOf} holidays={holidaysFor(d.date)} />
      })}
      <Sheet page open={!!adjusting} title="edit trip" onClose={() => setAdjusting(null)}>
        {adjusting && <TripForm key={adjusting.id} trip={adjusting} onDone={() => setAdjusting(null)} onDeleted={() => setAdjusting(null)} />}
      </Sheet>
    </div>
  )
})

// a side trip on its parent's plan: one row that opens it, with what's in it at a glance
function SideTrip({ row, today }: { row: SideRow; today: string }) {
  const on = row.date <= today && row.end >= today
  const what = [row.places ? `${row.places} ${row.places === 1 ? 'place' : 'places'}` : '', on ? 'on now' : ''].filter(Boolean).join(' · ')
  return (
    <section className="doc-day side-row" id={`itin-side-${row.trip.id}`} data-date={row.date} style={tint(row.trip.color)} aria-label={row.trip.name}>
      <Link className="side-row-link" to={`/trip/${row.trip.id}${on ? `?day=${today}` : ''}`}>
        <span className="side-row-bar" aria-hidden="true" />
        <span className="side-row-body">
          <span className="mono-label">{fmtRange(row.date, row.end)} · {row.nights} {row.nights === 1 ? 'night' : 'nights'}</span>
          <span className="side-row-name">{row.trip.name}</span>
          {(what || row.toBook > 0) && <span className="side-row-what muted">{what}{row.toBook > 0 && <>{what ? ' · ' : ''}<span className="warn-text">{row.toBook} to do</span></>}</span>}
        </span>
        <span className="side-row-go" aria-hidden="true">→</span>
      </Link>
    </section>
  )
}

type DayProps = {
  day: ItinDay; trip: Trip; today: string; editing: boolean; canEdit: boolean; q: string; hidden: boolean; current: string | null
  onOpen?: (s: Stop, day?: string | null) => void; onLight: (id: string | null) => void; infoOf: (s: Stop) => LineInfo
  holidays?: Holiday[]
}

// a day is only asked for its walks once it's (nearly) on screen
function useOnScreen<T extends Element>(): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || on) return
    if (typeof IntersectionObserver === 'undefined') { setOn(true); return }
    const io = new IntersectionObserver((xs) => { if (xs.some((x) => x.isIntersecting)) setOn(true) }, { rootMargin: '300px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [on])
  return [ref, on]
}

function Day({ day, trip, today, editing, canEdit, q, hidden, current, onOpen, onLight, infoOf, holidays = [] }: DayProps) {
  const [box, onScreen] = useOnScreen<HTMLElement>()
  const move = useMove(trip)
  const drag = useDrag()
  const areas = dayAreas(day.entries)
  const side = day.owner.id !== trip.id ? day.owner : null
  const timed = day.entries.some((e) => e.kind === 'stop' && e.stop?.time)
  const legs = useMemo(() => dayLegs(day.entries), [day.entries])
  const numbers = useMemo(() => pinNumbers(day.entries), [day.entries])
  const walk = useWalks(legs, onScreen)
  // every line moves (stays don't: their nights change in their card)
  const lines = day.entries.filter((e) => e.kind === 'stop' && e.stop).map((e) => e.stop!)
  const here = drag?.target?.day === day.date ? drag.target : null

  // one line up or down; past either end of the day it goes into the day before or after
  function nudge(s: Stop, dir: -1 | 1) {
    const i = lines.findIndex((x) => x.id === s.id)
    if (dir < 0 && i > 0) { move(s, day.date, lines[i - 1].id); return }
    if (dir > 0 && i < lines.length - 1) { move(s, day.date, lines[i + 2]?.id ?? null); return }
    const days = [...document.querySelectorAll<HTMLElement>('[data-drop-day]')].map((el) => el.dataset.dropDay!)
    const other = days[days.indexOf(day.date) + dir]
    if (!other) return
    const first = document.querySelector<HTMLElement>(`[data-drop-day="${other}"] [data-drop-line]`)?.dataset.dropLine ?? null
    move(s, other, dir < 0 ? null : first)
    const refocus = () => document.querySelector<HTMLElement>(`[data-line="${CSS.escape(s.id)}"] :is(.doc-name, .itin-main)`)?.focus()
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(refocus)
  }
  // ⌥↑ / ⌥↓ (alt) moves the line you're on, like moving a paragraph in a doc
  function key(e: KeyboardEvent<HTMLElement>, s: Stop) {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
    e.preventDefault()
    nudge(s, e.key === 'ArrowUp' ? -1 : 1)
  }

  if (hidden) return <section id={`itin-${day.date}`} data-date={day.date} className="doc-day folded-out" ref={box} />
  return (
    <section className={`doc-day${day.date === today ? ' is-today' : ''}`} id={`itin-${day.date}`} data-date={day.date} data-testid={`itin-${day.date}`} ref={box} data-drop-day={canEdit ? day.date : undefined}
      style={tint((side ?? trip).color)} aria-labelledby={`h-${day.date}`}>
      <header className="doc-day-head">
        <h2 className="doc-date" id={`h-${day.date}`}>{fmtDay(day.date, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
        {(day.date === today || side || areas.length > 0) && <p className="doc-day-meta mono">
          {day.date === today && <span className="today-tag">today</span>}
          {side && <Link className="side-tag" to={`/trip/${side.id}`}><span className="dot" />{side.name}</Link>}
          {areas.slice(0, 3).map((a) => <span key={a}>{a.toLowerCase()}</span>)}
        </p>}
      </header>
      <div className="doc-lines">
        {holidays.map((h) => (
          <div key={`${h.country}-${h.name}`} className="itin-line quiet holiday-line" data-testid="holiday">
            <span className="itin-time" />
            <span className="cat holiday-mark"><CountryFlag code={h.country} /></span>
            <span className="itin-main">
              <span className="itin-title">{h.name}</span>
              <span className="itin-sub muted"><span className="keep-case">{h.local}</span> · public holiday in {countryName(h.country)}</span>
            </span>
            <span className="itin-end"><span className="pill warn">public holiday</span></span>
          </div>
        ))}
        {day.entries.map((e, i) => {
          const s = e.stop!
          // the same number as its pin on the map: only lines with a spot on the map have one
          const seq = e.kind === 'stop' ? numbers.get(s.id) : undefined
          const isMove = canEdit && e.kind === 'stop'
          const name = stopTitle(s).toLowerCase() || 'line'
          const incoming = legs.find((l) => l.to.id === s.id && !l.evening) ?? legs.find((l) => l.to.id === s.id)
          return (
            <div key={`${s.id}-${e.kind}`} data-drop-line={e.kind === 'stop' ? s.id : undefined}
              className={drag?.carrying?.kind === 'line' && drag.carrying.stop.id === s.id && e.kind === 'stop' ? 'dragging' : undefined}
              // no handle: hold a line still for a moment, then carry it. a quick press still opens or edits it
              onPointerDown={isMove && drag ? (ev) => { if (ev.button === 0 && !(ev.target as Element).closest('button, a')) drag.begin({ kind: 'line', stop: s, label: name }, ev, { hold: HOLD }) } : undefined}
              onKeyDown={isMove ? (ev) => key(ev, s) : undefined}>
              {here && e.kind === 'stop' && here.before === s.id && <div className="drop-rule" aria-hidden="true" />}
              <ItinLine editing={editing} entry={e} seq={seq} any={timed && e.kind === 'stop'} q={q} info={infoOf(s)}
                current={current === s.id && e.kind !== 'staying' && e.kind !== 'checkout'} day={day.date} onOpen={onOpen} onLight={onLight} />
              <DirectionsLine stop={s} leg={incoming} answer={incoming ? walk(incoming.a, incoming.b) : null} />
            </div>
          )
        })}
        {here && here.before === null && <div className="drop-rule" aria-hidden="true" />}
        {canEdit && <AddLine trip={day.owner} day={day.date} />}
      </div>
    </section>
  )
}

// Directions belong to this destination; a journey's destination here is where you board it.
function DirectionsLine({ stop, leg, answer }: { stop: Stop; leg?: Leg; answer: WalkAnswer }) {
  const at = placeIn(stop)
  const href = directionsUrl(at)
  if (!href) return null
  const flight = stop.kind === 'journey' && stop.mode === 'flight'
  const label = flight ? 'to departure airport' : 'directions'
  const words = walkWords(answer)
  const estimate = words && leg ? `${words} from ${leg.a.name || 'the previous stop'}` : null
  return (
    <Tooltip text={`open directions from your current location to ${at?.name || 'this place'} in Google Maps`}><a className="walk" href={href}
      aria-label={`${flight ? 'directions to departure airport' : 'directions to'} ${at?.name || 'this place'}${estimate ? ` · ${estimate}` : ''}`} target="_blank" rel="noopener noreferrer">
      <Icon name="ext" size={14} /><span>{label}{estimate && ` · ${estimate}`}</span><span aria-hidden="true">→</span>
    </a></Tooltip>
  )
}
