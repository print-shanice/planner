import { lazy, Suspense, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLinks, useReviews, useStops, useTrips } from '../../lib/queries'
import { countryName, countryStatus, globePins, homeLists, homeTotals, tripsInCountry } from '../../lib/countries'
import { addDays, byStart, countdown, fmtDay, todayISO } from '../../lib/dates'
import { resumePlan } from '../../lib/resume'
import { useCanEdit } from '../../lib/offline'
import { loadState } from '../../lib/load'
import type { Trip } from '../../lib/types'
import { Sheet } from '../../components/Sheet'
import { EmptyState } from '../../components/EmptyState'
import { LoadState } from '../../components/States'
import { Icon } from '../../components/Icon'
import { Loading } from '../../components/Loading'
import { OfflineBadge } from '../../components/OfflineBadge'
import { Totals } from './Totals'
import { TripRow } from './Upcoming'
import { HomeStamp, TripFamilies, leadTrip } from './Trips'
import { useTripFlags } from '../../lib/tripGuess'
import { useKnownCities } from '../../lib/knownCities'
import { Calendar } from './Calendar'
import { MonthSide } from './MonthSide'
import { countriesOn, holidaysOn, useHolidays } from '../../lib/holidays'
import { ownerOn } from '../../lib/agenda'
import { Travels } from './Travels'
import { TripForm } from './TripForm'
import { AccountButton } from './Account'
import { Inbox } from './Inbox'
import { CaptureForm } from '../capture/CaptureForm'
import { peekPending } from '../../lib/capture'
import { HomePacking } from '../packing/HomePacking'

// trips grouped by the month they start, in order; undated ones last
function byMonth(tops: Trip[]): [string, Trip[]][] {
  const groups = new Map<string, Trip[]>()
  for (const t of tops) {
    const label = t.start_date ? fmtDay(t.start_date, { month: 'long', year: 'numeric' }) : 'no dates yet'
    groups.set(label, [...(groups.get(label) ?? []), t])
  }
  return [...groups]
}

type ShowAs = 'list' | 'month'
const readShowAs = (): ShowAs => { try { return localStorage.getItem('home-show') === 'month' ? 'month' : 'list' } catch { return 'list' } }

// maplibre is large and needs webgl; load it after the page shows
const Globe = lazy(() => import('./Globe').then((m) => ({ default: m.Globe })))

type View = 'trips' | 'inbox' | 'packing' | 'travels'
const VIEWS: View[] = ['trips', 'inbox', 'packing', 'travels']

export function HomePage() {
  const travelsId = useId()
  const [params] = useSearchParams()
  // one view at a time; home always opens on trips
  const view: View = VIEWS.find((v) => v === params.get('view')) ?? 'trips'
  // the new view slides in from the side you moved towards (the first one just appears)
  const [shown, setShown] = useState<{ view: View; from: '' | 'from-left' | 'from-right' }>({ view, from: '' })
  if (shown.view !== view) setShown({ view, from: VIEWS.indexOf(view) > VIEWS.indexOf(shown.view) ? 'from-right' : 'from-left' })
  const tq = useTrips()
  const sq = useStops()
  const trips = tq.data ?? []
  const stops = sq.data ?? []
  const flagsOf = useTripFlags(trips, stops)
  const reviews = useReviews().data ?? []
  const load = loadState(tq, sq)
  const canEdit = useCanEdit()
  const navigate = useNavigate()
  const today = todayISO()
  const [adding, setAdding] = useState(false)
  const [country, setCountry] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)
  // the list, or the month calendar; remembered on this device
  const [shownAs, setShownAs] = useState<ShowAs>(readShowAs)
  const showAs = (v: ShowAs) => { setShownAs(v); try { localStorage.setItem('home-show', v) } catch { /* private mode */ } }
  const [linking, setLinking] = useState(false)
  const inbox = (useLinks().data ?? []).filter((l) => !l.trip_id)
  const waiting = peekPending()
  // the underline slides to the chosen view
  const nav = useRef<HTMLElement>(null)
  const [ink, setInk] = useState<{ x: number; w: number } | null>(null)
  useLayoutEffect(() => {
    const el = nav.current
    if (!el) return
    const measure = () => {
      const on = el.querySelector<HTMLElement>('[aria-current="page"]')
      if (on) setInk((was) => (was && was.x === on.offsetLeft && was.w === on.offsetWidth ? was : { x: on.offsetLeft, w: on.offsetWidth }))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [view, inbox.length, !!waiting])

  const status = useMemo(() => countryStatus(trips, stops, today), [trips, stops, today])
  const pins = useMemo(() => globePins(trips, stops, today), [trips, stops, today])
  const known = useKnownCities()
  const totals = useMemo(() => homeTotals(trips, stops, today, known), [trips, stops, today, known])
  const lists = useMemo(() => homeLists(trips, stops, today, known), [trips, stops, today, known])

  const top = trips.filter((t) => !t.parent_id)
  const upcoming = top.filter((t) => countdown(t, today).kind !== 'done').sort(byStart)
  const past = top.filter((t) => countdown(t, today).kind === 'done').sort((a, b) => byStart(b, a))
  const lead = leadTrip(trips, today)
  const resume = resumePlan(trips, stops, today)
  // "open the plan" goes back to the day you were on, when it was this trip
  const leadHref = lead ? (resume?.tripId === lead.id && resume.day ? `/trip/${lead.id}?day=${resume.day}` : `/trip/${lead.id}`) : ''
  const waitingCount = inbox.length + (waiting ? 1 : 0)
  // public holidays where the coming trips go, for the month view: each day's, in the countries you'll be in that day
  const coming = trips.filter((t) => countdown(t, today).kind !== 'done' && t.start_date)
  const holidayDays = useHolidays(coming.flatMap((t) => [t.base?.country ?? '', ...flagsOf(t)]).filter(Boolean),
    coming.map((t) => t.start_date!).sort()[0] ?? null, coming.map((t) => t.end_date ?? t.start_date!).sort().at(-1) ?? null)
  const topOn = (d: string) => upcoming.find((t) => t.start_date && t.start_date <= d && (t.end_date ?? t.start_date) >= d)
  const holidaysOnDay = (d: string) => {
    const top = topOn(d)
    return top ? holidaysOn(holidayDays, d, countriesOn(top, trips, stops, d, flagsOf)).map((h) => ({ ...h, trip: ownerOn(top, trips, d) })) : []
  }
  const holidayName = (d: string) => holidaysOnDay(d).map((h) => h.name.toLowerCase()).join(', ') || null
  const holidaysBetween = (from: string, to: string) => {
    const out = []
    for (let d = from; d <= to; d = addDays(d, 1)) out.push(...holidaysOnDay(d))
    return out
  }

  const choices = country ? tripsInCountry(country, trips, stops) : []

  function pickCountry(code: string) {
    const list = tripsInCountry(code, trips, stops)
    if (list.length === 1) navigate(`/trip/${list[0].id}`)
    else if (list.length > 1) setCountry(code)
  }

  return (
    <main className="home">
      <header className="home-top">
        <h1 className="wordmark home-mark">planner</h1>
        <OfflineBadge inline />
        <nav ref={nav} className={`home-views${ink ? ' inked' : ''}`} aria-label="home">
          {VIEWS.map((v) => (
            <Link key={v} to={v === 'trips' ? '/' : `/?view=${v}`} className="home-view" aria-current={view === v ? 'page' : undefined}>
              {v === 'inbox' && waitingCount > 0 ? `inbox · ${waitingCount}` : v}
            </Link>
          ))}
          <span className="home-views-ink" aria-hidden="true" style={ink ? { width: ink.w, transform: `translateX(${ink.x}px)` } : undefined} />
        </nav>
        <AccountButton />
        <HomeStamp trips={trips} today={today} flagsOf={flagsOf} />
      </header>

      <div key={view} className={`home-body ${shown.from}`.trim()}>
        {view === 'trips' && (
          <div className="home-trips">
            <LoadState load={load} />
            {/* the schedule: trips by the month they start, side trips in their trip's band; the month calendar is a switch away */}
            <section className="home-section home-upcoming">
              <div className="section-head">
                <h2 className="head">upcoming trips</h2>
                {upcoming.length > 0 && (
                  <div className="show-as" role="group" aria-label="show trips as">
                    <button type="button" aria-pressed={shownAs === 'list'} onClick={() => showAs('list')}>list</button>
                    <button type="button" aria-pressed={shownAs === 'month'} onClick={() => showAs('month')}>month</button>
                  </div>
                )}
                <button type="button" className="icon-btn plus-btn" aria-label="add" disabled={!canEdit} onClick={() => setMenu(true)}>
                  <Icon name="plus" />
                </button>
              </div>
              {load.state === 'ready' && trips.length === 0 && <EmptyState title="no trips yet" />}
              {load.state === 'ready' && trips.length > 0 && upcoming.length === 0 && <EmptyState title="nothing coming up" />}
              {upcoming.length > 0 && shownAs === 'month' && (
                <Calendar trips={trips} flagsOf={flagsOf} today={today} holiday={holidayName}
                  aside={(m) => <MonthSide month={m} trips={trips} stops={stops} flagsOf={flagsOf} holidays={holidaysBetween} />} />
              )}
              {upcoming.length > 0 && shownAs === 'list' && byMonth(upcoming).map(([label, group]) => (
                <div key={label} className="month-group">
                  <p className="month-h">{label}</p>
                  <TripFamilies tops={group} trips={trips} flagsOf={flagsOf} today={today} hrefOf={(t) => (t.id === lead?.id ? leadHref : `/trip/${t.id}`)} />
                </div>
              ))}
            </section>
            {/* only shows once a trip has ended */}
            {past.length > 0 && (
              <section className="home-section home-past">
                <div className="section-head"><h2 className="head">past trips</h2></div>
                <TripFamilies tops={past} trips={trips} flagsOf={flagsOf} today={today} keepEnded />
              </section>
            )}
          </div>
        )}

        {view === 'inbox' && (
          <div className="home-inbox-view">
            {waiting && (
              <Link className="resume-plan waiting" to="/save">
                <span className="mono-label">not saved yet</span>
                <span className="head resume-name">{waiting.url || waiting.text || 'a link'}</span>
                <span className="text-link">save it →</span>
              </Link>
            )}
            {inbox.length > 0 && <Inbox links={inbox} trips={trips} />}
            {inbox.length === 0 && !waiting && <EmptyState title="inbox is empty" />}
          </div>
        )}

        {view === 'packing' && <section className="home-packing-view" aria-label="packing"><HomePacking trips={trips} /></section>}

        {view === 'travels' && (
          <Travels trips={trips} stops={stops} reviews={reviews} today={today} globe={({ routes, focus, ready }) => (
            /* the globe and its numbers in one card */
            <div className="travels-card">
              {ready ? (
                <Suspense fallback={<div className="globe-wrap"><Loading label="loading globe" size="small" className="globe-loading" /></div>}>
                  <Globe status={status} pins={pins} onCountry={pickCountry} routes={routes} focus={focus} />
                </Suspense>
              ) : <div className="globe-wrap"><Loading label="loading globe" size="small" className="globe-loading" /></div>}
              {trips.length > 0 && (
                <div className="totals-block">
                  <p className="head totals-title" id={travelsId}>life well lived</p>
                  <Totals {...totals} lists={lists} labelledBy={travelsId} />
                </div>
              )}
            </div>
          )} />
        )}
      </div>

      <Sheet open={menu} title="add" onClose={() => setMenu(false)}>
        <ul className="add-options">
          <li><button type="button" className="add-option" onClick={() => { setMenu(false); setAdding(true) }}><span className="add-icon"><Icon name="calendar" /></span><span>trip</span></button></li>
          <li><button type="button" className="add-option" onClick={() => { setMenu(false); setLinking(true) }}><span className="add-icon"><Icon name="link" /></span><span>link</span></button></li>
        </ul>
      </Sheet>
      <Sheet page open={linking} title="save a link" onClose={() => setLinking(false)}>
        <CaptureForm initial={null} tripId={null} onDone={() => setLinking(false)} />
      </Sheet>
      <Sheet page open={adding} title="new trip" onClose={() => setAdding(false)}>
        <TripForm onDone={() => setAdding(false)} />
      </Sheet>
      <Sheet open={!!country} title={country ? countryName(country) : ''} onClose={() => setCountry(null)}>
        <div className="rows">{choices.map((t) => <TripRow key={t.id} trip={t} />)}</div>
      </Sheet>
    </main>
  )
}
