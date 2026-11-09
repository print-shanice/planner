import { lazy, Suspense, useId, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLinks, useStops, useTrips } from '../../lib/queries'
import { countryName, countryStatus, globePins, homeLists, homeTotals, tripsInCountry } from '../../lib/countries'
import { countdown, todayISO, fmtDay } from '../../lib/dates'
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
import { Calendar } from './Calendar'
import { TripForm } from './TripForm'
import { AccountButton } from './Account'
import { Inbox } from './Inbox'
import { CaptureForm } from '../capture/CaptureForm'
import { peekPending } from '../../lib/capture'

// maplibre is large and needs webgl; load it after the page shows
const Globe = lazy(() => import('./Globe').then((m) => ({ default: m.Globe })))

export function HomePage() {
  const travelsId = useId()
  const tq = useTrips()
  const sq = useStops()
  const trips = tq.data ?? []
  const stops = sq.data ?? []
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

  const status = useMemo(() => countryStatus(trips, stops, today), [trips, stops, today])
  const pins = useMemo(() => globePins(trips, stops, today), [trips, stops, today])
  const totals = useMemo(() => homeTotals(trips, stops), [trips, stops])
  const lists = useMemo(() => homeLists(trips, stops), [trips, stops])

  const top = trips.filter((t) => !t.parent_id)
  const byStart = (a: Trip, b: Trip) => (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999') || a.name.localeCompare(b.name)
  const upcoming = top.filter((t) => countdown(t, today).kind !== 'done').sort(byStart)
  const past = top.filter((t) => countdown(t, today).kind === 'done').sort((a, b) => byStart(b, a))
  const resume = resumePlan(trips, stops, today)
  const resumeTrip = trips.find(t => t.id === resume?.tripId)

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
        <AccountButton />
      </header>

      {waiting && (
        <Link className="resume-plan waiting" to="/save">
          <span className="mono-label">not saved yet</span>
          <span className="head resume-name">{waiting.url || waiting.text || 'a link'}</span>
          <span className="text-link">save it →</span>
        </Link>
      )}
      {resumeTrip && resume && (
        <Link className="resume-plan" to={`/trip/${resumeTrip.id}${resume.day ? `?day=${resume.day}` : ''}`}>
          <span className="mono-label">{resume.day === today ? 'today' : 'continue'}</span>
          <span className="head resume-name">{resumeTrip.name}</span>
          <span className="text-link">{resume.day ? fmtDay(resume.day, { weekday: 'long', day: 'numeric', month: 'long' }) : 'open the plan'} →</span>
        </Link>
      )}

      <section className="home-section home-next">
        <div className="section-head">
          <h2 className="head">next up</h2>
          <button type="button" className="icon-btn filled" aria-label="add" disabled={!canEdit} onClick={() => setMenu(true)}>
            <Icon name="plus" />
          </button>
        </div>
        <LoadState load={load} blocks={1} />
        {load.state === 'ready' && trips.length === 0 && <EmptyState title="no trips yet" />}
        {load.state === 'ready' && trips.length > 0 && upcoming.length === 0 && <EmptyState title="nothing coming up" />}
        {upcoming.length > 0 && <Calendar trips={trips} today={today} />}
      </section>

      {inbox.length > 0 && <Inbox links={inbox} trips={trips} />}

      <div className="home-world">
        {/* a summary of where your travels have taken you: the globe and its numbers in one card */}
        <div className="section-head"><h2 id={travelsId} className="head">your travels, wrapped</h2></div>
        <div className="travels-card">
          <Suspense fallback={<div className="globe-wrap"><Loading label="loading globe" size="small" /></div>}>
            <Globe status={status} pins={pins} onCountry={pickCountry} />
          </Suspense>
          {trips.length > 0 && (
            <div className="totals-block">
              <p className="head totals-title">life well lived</p>
              <Totals {...totals} lists={lists} labelledBy={travelsId} />
            </div>
          )}
        </div>
      </div>

      {/* only shows once a trip has ended */}
      {past.length > 0 && (
        <section className="home-section home-past">
          <div className="section-head"><h2 className="head">past trips</h2></div>
          <div className="rows">{past.map((t) => <TripRow key={t.id} trip={t} />)}</div>
        </section>
      )}

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
