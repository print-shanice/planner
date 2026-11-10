import { lazy, Suspense, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLinks, useReviews, useStops, useTrips } from '../../lib/queries'
import { countryName, countryStatus, globePins, homeLists, homeTotals, tripsInCountry } from '../../lib/countries'
import { countdown, todayISO } from '../../lib/dates'
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
import { Lead, TripFamilies, leadTrip } from './Trips'
import { Calendar } from './Calendar'
import { Travels } from './Travels'
import { TripForm } from './TripForm'
import { AccountButton } from './Account'
import { Inbox } from './Inbox'
import { CaptureForm } from '../capture/CaptureForm'
import { peekPending } from '../../lib/capture'

// maplibre is large and needs webgl; load it after the page shows
const Globe = lazy(() => import('./Globe').then((m) => ({ default: m.Globe })))

type View = 'trips' | 'inbox' | 'travels'
const VIEWS: View[] = ['trips', 'inbox', 'travels']

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
  const reviews = useReviews().data ?? []
  const load = loadState(tq, sq)
  const canEdit = useCanEdit()
  const navigate = useNavigate()
  const today = todayISO()
  const [adding, setAdding] = useState(false)
  const [country, setCountry] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)
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
  const totals = useMemo(() => homeTotals(trips, stops), [trips, stops])
  const lists = useMemo(() => homeLists(trips, stops), [trips, stops])

  const top = trips.filter((t) => !t.parent_id)
  const byStart = (a: Trip, b: Trip) => (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999') || a.name.localeCompare(b.name)
  const upcoming = top.filter((t) => countdown(t, today).kind !== 'done').sort(byStart)
  const past = top.filter((t) => countdown(t, today).kind === 'done').sort((a, b) => byStart(b, a))
  const lead = leadTrip(trips, today)
  const resume = resumePlan(trips, stops, today)
  // "open the plan" goes back to the day you were on, when it was this trip
  const leadHref = lead ? (resume?.tripId === lead.id && resume.day ? `/trip/${lead.id}?day=${resume.day}` : `/trip/${lead.id}`) : ''
  const waitingCount = inbox.length + (waiting ? 1 : 0)

  const choices = country ? tripsInCountry(country, trips, stops) : []

  function pickCountry(code: string) {
    const list = tripsInCountry(code, trips, stops)
    if (list.length === 1) navigate(`/trip/${list[0].id}`)
    else if (list.length > 1) setCountry(code)
  }

  return (
    <main className="home">
      <header className="home-top">
        <h1 className="wordmark home-mark">
          <img src={`${import.meta.env.BASE_URL}wordmark.svg`} alt="planner" width="1367" height="468" />
        </h1>
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
      </header>

      <div key={view} className={`home-body ${shown.from}`.trim()}>
        {view === 'trips' && (
          <div className="home-trips">
            <LoadState load={load} blocks={1} />
            {lead && <Lead trip={lead} today={today} href={leadHref} />}
              {/* "upcoming" heads both: the month, then each trip's card (on a laptop side by side) */}
            <section className="home-section home-upcoming">
              <div className="section-head">
                <h2 className="head">upcoming</h2>
                <button type="button" className="icon-btn filled" aria-label="add" disabled={!canEdit} onClick={() => setMenu(true)}>
                  <Icon name="plus" />
                </button>
              </div>
              {load.state === 'ready' && trips.length === 0 && <EmptyState title="no trips yet" />}
              {load.state === 'ready' && trips.length > 0 && upcoming.length === 0 && <EmptyState title="nothing coming up" />}
              {upcoming.length > 0 && (
                <div className="home-plans">
                  <Calendar trips={trips} today={today} />
                  <TripFamilies tops={upcoming} trips={trips} today={today} />
                </div>
              )}
            </section>
            {/* only shows once a trip has ended */}
            {past.length > 0 && (
              <section className="home-section home-past">
                <div className="section-head"><h2 className="head">past</h2></div>
                <TripFamilies tops={past} trips={trips} today={today} keepEnded />
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
