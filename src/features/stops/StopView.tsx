import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Cost, Member, Stop, Trip } from '../../lib/types'
import { useCosts, useFiles, useLinks, useMembers, useRemove, useSave, useStops, useTrips } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { addDays, daysBetween, fmtDay, nights } from '../../lib/dates'
import { formatMoney } from '../../lib/money'
import { positionsAfterMove } from '../../lib/order'
import { gmapsUrl } from '../../lib/gmaps'
import { supabase } from '../../lib/supabase'
import { safeUrl } from '../../lib/embed'
import { Pill } from '../../components/Pill'
import { Icon } from '../../components/Icon'
import { Button } from '../../components/Button'
import { Copy } from '../../components/Copy'
import { TwoTapDelete } from '../../components/TwoTapDelete'
import { FilesSection, filesOf } from './FilesSection'
import { Reviews } from './Reviews'
import { saveError } from '../../lib/errors'
import { stopSub, stopTitle } from '../plan/StopRow'
import { FlightFacts } from './FlightFacts'
import { directionsUrl } from '../../lib/gmaps'
import { ancestors, descendants } from '../../lib/countries'
import { useStopSheet } from './StopSheet'
import { dayEntries } from '../../lib/agenda'
import { dayLegs, nextFrom, type Leg } from '../../lib/legs'
import { scheduleChange, unscheduleChange } from '../../lib/schedule'
import { tripDays } from '../../lib/dates'
import { hostOf as host } from '../../lib/embed'
import { Sheet } from '../../components/Sheet'
import { CaptureForm } from '../capture/CaptureForm'
import { CostForm } from '../money/CostForm'
import { PlaceDetails } from './PlaceDetails'
import { expenseCategory } from '../../lib/categories'
import { SiteIcon } from '../saved/LinkCard'
import { Help, Tooltip } from '../../components/Tooltip'

const day = (d: string | null, t?: string | null) => (d ? [fmtDay(d, { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', ''), t].filter(Boolean).join(' · ') : t ?? '')

// the next stop as the day lists it; a journey by where you board it
const nextName = (l: Leg) => (l.to.kind === 'journey' ? l.b.name || stopTitle(l.to) : stopTitle(l.to) || l.b.name)


// who a cost is for, in a few words
export function splitLine(c: Cost, members: Member[]): string {
  const who = (id: string) => members.find((m) => m.user_id === id)?.name ?? 'someone'
  if (c.split_amounts && Object.keys(c.split_amounts).length) return 'exact amounts'
  const among = c.split_among?.length ? c.split_among : c.split !== 'even' ? [c.split] : null
  const everyone = members.filter((m) => m.user_id).map((m) => m.user_id!)
  if (!among || (among.length === everyone.length && among.every((x) => everyone.includes(x)))) return 'split evenly'
  return among.length === 1 ? `only for ${who(among[0])}` : `for ${among.map(who).join(' and ')}`
}

function costLine(c: Cost, members: Member[]) {
  const who = (id: string | null) => members.find((m) => m.user_id === id)?.name
  const parts = [formatMoney(c.amount, c.currency)]
  parts.push(c.status === 'paid' ? (c.paid_by ? `paid by ${who(c.paid_by) ?? 'someone'}` : 'paid') : 'not paid')
  parts.push(splitLine(c, members))
  return parts.join(' · ')
}

type Props = { stop: Stop; day?: string | null; onEdit: () => void; onClose: () => void }

const spotOf = (s: Stop) => [s.place, s.origin].find((p) => p != null && Number.isFinite(p.lat) && Number.isFinite(p.lng)) ?? null
function km(a: { lat?: number | null; lng?: number | null }, b: { lat?: number | null; lng?: number | null }): number {
  const r = Math.PI / 180, dLat = (b.lat! - a.lat!) * r, dLng = (b.lng! - a.lng!) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat! * r) * Math.cos(b.lat! * r) * Math.sin(dLng / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}

// what a place sits among, as links: the trips it's part of, the rest of its day, and saved places close by
function Related({ stop, on, trips, stops, onClose }: { stop: Stop; on: string | null | undefined; trips: Trip[]; stops: Stop[]; onClose: () => void }) {
  const sheet = useStopSheet()
  const own = trips.find((t) => t.id === stop.trip_id)
  const chain = [own, ...ancestors(stop.trip_id, trips).reverse()].filter((t): t is Trip => !!t)
  const top = chain.at(-1)
  const sameDay = on && top ? dayEntries(top, trips, stops, on).filter((e) => e.kind === 'stop' && e.stop && e.stop.id !== stop.id && e.stop.kind !== 'note').map((e) => e.stop!) : []
  const here = spotOf(stop)
  const family = new Set(top ? descendants(top.id, trips) : [stop.trip_id])
  const near = here ? stops
    .filter((s) => s.id !== stop.id && family.has(s.trip_id) && s.kind === 'place' && !sameDay.some((x) => x.id === s.id))
    .flatMap((s) => { const p = spotOf(s); const d = p ? km(here, p) : Infinity; return d <= 2 ? [{ s, d }] : [] })
    .sort((a, b) => a.d - b.d).slice(0, 3) : []
  if (chain.length < 2 && !sameDay.length && !near.length) return null
  const open = (s: Stop) => sheet?.openStop(s.id, s.day)
  return (
    <dl className="related">
      {chain.length > 0 && <><dt className="mono-label">part of</dt><dd>{chain.map((t, i) => <span key={t.id}>{i > 0 && ' · '}<Link to={`/trip/${t.id}${on ? `?day=${on}` : ''}`} onClick={onClose}>{t.name}</Link></span>)}</dd></>}
      {sameDay.length > 0 && <><dt className="mono-label">same day</dt><dd>{sameDay.slice(0, 4).map((s, i) => <span key={s.id}>{i > 0 && ' · '}<button type="button" className="rel-link" onClick={() => open(s)}>{stopTitle(s).toLowerCase()}</button></span>)}</dd></>}
      {near.length > 0 && <><dt className="mono-label">nearby</dt><dd>{near.map(({ s, d }, i) => <span key={s.id}>{i > 0 && ' · '}<button type="button" className="rel-link" onClick={() => open(s)}>{stopTitle(s).toLowerCase()}</button> <span className="tag">{d < 1 ? `${Math.max(50, Math.round(d * 20) * 50)} m` : `${d.toFixed(1)} km`}</span>{!s.day && <span className="tag"> idea</span>}</span>)}</dd></>}
    </dl>
  )
}

export function StopView({ stop, day: openedOn, onEdit, onClose }: Props) {
  const canEdit = useCanEdit()
  const trips = useTrips().data ?? []
  const stops = useStops().data ?? []
  const costs = useCosts().data ?? []
  const files = useFiles().data
  const members = useMembers().data ?? []
  const save = useSave('stops')
  const saveCost = useSave('costs')
  const remove = useRemove('stops')
  const [problem, setProblem] = useState<string | null>(null)
  const [linking, setLinking] = useState(false)
  // a cost being changed on the card, or 'new' for one being added to this booking
  const [costing, setCosting] = useState<Cost | 'new' | null>(null)
  const inspiration = (useLinks().data ?? []).filter((l) => l.stop_id === stop.id)
  const picker = useRef<{ open: () => void }>(null)
  const navigate = useNavigate()
  // every cost attached to this booking (a deposit and a balance can be two), oldest first
  const linked = costs.filter((c) => c.stop_id === stop.id).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
  const maps = gmapsUrl(stop)
  const address = stop.place ? [stop.place.name, stop.place.address].filter(Boolean).join(', ') : ''

  const siblings = stops
    .filter((s) => s.trip_id === stop.trip_id && s.day && s.day === stop.day)
    .sort((a, b) => a.position - b.position || (a.time ?? '99').localeCompare(b.time ?? '99'))
  const at = siblings.findIndex((s) => s.id === stop.id)

  async function run(fn: () => Promise<unknown>) {
    setProblem(null)
    try { await fn() } catch (e) { setProblem(saveError(e)) }
  }

  const shift = (to: number) => run(async () => {
    for (const c of positionsAfterMove(siblings.map((s) => s.id), at, to, siblings.map((s) => s.position))) await save.mutateAsync(c)
  })

  // a day, another day, or back to no date: only the date changes, everything else stays with it
  const moveDay = (d: string) => run(async () => {
    await save.mutateAsync(d ? scheduleChange(stop, d, stops) : unscheduleChange(stop, stops))
  })
  const home = trips.find((t) => t.id === stop.trip_id)
  const days = home ? tripDays(home) : []
  const dayChoices = stop.day && !days.includes(stop.day) ? [stop.day, ...days].sort() : days

  const moveTrip = (tripId: string) => run(async () => {
    await save.mutateAsync({ id: stop.id, trip_id: tripId })
    for (const c of linked) await saveCost.mutateAsync({ id: c.id, trip_id: tripId })
  })

  const del = () => run(async () => {
    const paths = filesOf(files, stop.id).map((f) => f.path)
    if (paths.length) {
      const { error } = await supabase.storage.from('files').remove(paths)
      if (error) throw error
    }
    await remove.mutateAsync(stop.id)
    onClose()
  })

  const n = stop.kind === 'stay' ? nights(stop.day, stop.end_date) : null
  const facts: (string | null)[] = []
  if (stop.kind === 'stay') {
    facts.push(stop.day ? `check-in ${day(stop.day, stop.time)}` : null)
    facts.push(stop.end_date ? `check-out ${day(stop.end_date, stop.end_time)}` + (n ? ` · ${n} ${n === 1 ? 'night' : 'nights'}` : '') : null)
  } else if (stop.kind === 'journey') {
    facts.push([stop.mode, stop.origin && stop.destination ? stop.title : ''].filter(Boolean).join(' · ') || null)
    facts.push(stop.day ? `depart ${day(stop.day, stop.time)}` : null)
    facts.push(stop.end_date || stop.end_time ? `arrive ${day(stop.end_date, stop.end_time)}` : null)
  } else {
    facts.push(day(stop.day, stop.time ? [stop.time, stop.end_time].filter(Boolean).join('–') : null) || null)
  }

  // the place on its day's map, with its card open
  const showOnMap = () => {
    const q = new URLSearchParams({ tab: 'map', ...(stop.day ? { day: stop.day } : {}), pin: stop.id })
    onClose()
    navigate(`/trip/${stop.trip_id}?${q}`)
  }
  const what = stop.kind === 'place' ? stopSub(stop) : ''
  // without a spot on the map there's nothing for "map" to show; the card offers to add one instead
  const spot = [stop.place, stop.destination, stop.origin].some((p) => p != null && Number.isFinite(p.lat) && Number.isFinite(p.lng))

  // the way on to the next stop of the day it was opened from (else its own day); the top trip owns the day's legs
  const on = openedOn ?? stop.day
  const top = ancestors(stop.trip_id, trips)[0] ?? trips.find((t) => t.id === stop.trip_id)
  const leg = on && top ? nextFrom(stop.id, dayLegs(dayEntries(top, trips, stops, on))) : null

  return (
    <div className="stack stop-view">
      {(stop.status !== 'idea' || what) && (
        <div className="stop-kicker">
          {stop.status !== 'idea' && <Pill status={stop.status} kind={stop.kind} />}
          {/* a to-do is ticked off right here, without opening the form */}
          {stop.kind === 'note' && stop.status !== 'idea' && canEdit && (
            <button type="button" className="text-link" onClick={() => run(() => save.mutateAsync({ id: stop.id, status: stop.status === 'booked' ? 'to_book' : 'booked' }))}>
              {stop.status === 'booked' ? 'not done yet' : 'mark done'}
            </button>
          )}
          {what && <p className="muted">{what}</p>}
        </div>
      )}
      {stop.place?.gid && <PlaceDetails place={stop.place} day={stop.day} />}

      <div className="stop-actions" role="group" aria-label="actions">
        <button type="button" className="stop-action" disabled={!spot} onClick={showOnMap}><span className="ico"><Icon name="map" /></span>map</button>
        {maps
          ? <a className="stop-action" href={maps} target="_blank" rel="noopener noreferrer"><span className="ico"><Icon name="ext" /></span>directions</a>
          : <button type="button" className="stop-action" disabled><span className="ico"><Icon name="ext" /></span>directions</button>}
        <div className="help-row"><Tooltip text="attach a ticket or booking confirmation · PDF or image, up to 20 MB"><button type="button" className="stop-action" disabled={!canEdit} onClick={() => picker.current?.open()}><span className="ico"><Icon name="upload" /></span>ticket</button></Tooltip><Help label="about ticket uploads">attach a ticket or booking confirmation · PDF or image, up to 20 MB</Help></div>
      </div>

      {canEdit && (
        <div className="when-row plan-row" role="group" aria-label="when">
          {dayChoices.length ? (
            <select className="input" aria-label="day" value={stop.day ?? ''} onChange={(e) => moveDay(e.target.value)}>
              <option value="">no date</option>
              {dayChoices.map((d) => <option key={d} value={d}>{fmtDay(d, { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '')}</option>)}
            </select>
          ) : (
            <span className="date-and-clear">
              <input className="input" type="date" aria-label="day" value={stop.day ?? ''} onChange={(e) => moveDay(e.target.value)} />
              {stop.day && <button type="button" className="text-link" onClick={() => moveDay('')}>no date</button>}
            </span>
          )}
          <Help label="about dates and ideas">remove the date to keep this in Ideas for later; check-out and arrival dates are cleared too</Help>
          {stop.day && !stop.time && siblings.length > 1 && <>
            <button type="button" className="icon-btn" aria-label="earlier" disabled={at <= 0} onClick={() => shift(at - 1)}><Icon name="up" size={18} /></button>
            <button type="button" className="icon-btn" aria-label="later" disabled={at >= siblings.length - 1} onClick={() => shift(at + 1)}><Icon name="down" size={18} /></button>
          </>}
          <select className="input" aria-label="trip" value={stop.trip_id} onChange={(e) => { if (e.target.value !== stop.trip_id) moveTrip(e.target.value) }}>
            {[...trips].sort((a, b) => a.name.localeCompare(b.name)).map((t) => <option key={t.id} value={t.id}>{t.name.toLowerCase()}</option>)}
          </select>
        </div>
      )}

      <div className="facts">
        {facts.filter(Boolean).map((f) => <p key={f} className="fact"><Icon name="calendar" size={18} /><span>{f}</span></p>)}
        <FlightFacts stop={stop} />
        {leg && (
          <a className="fact fact-link" href={directionsUrl(leg.a, leg.b)} target="_blank" rel="noopener noreferrer">
            <Icon name="walk" size={18} /><span>{`next · ${nextName(leg).toLowerCase()}`}</span>
          </a>
        )}
        {address && stop.kind !== 'journey' && (
          <div className="fact fact-copy"><Icon name="pin" size={18} /><span className="copy-text">{address}</span><Copy text={address} label="copy address" /></div>
        )}
        {!spot && canEdit && (
          <p className="fact"><Icon name="pin" size={18} /><button type="button" className="text-link" onClick={onEdit}>add a location →</button></p>
        )}
        {stop.ref && (
          <div className="fact fact-copy"><Icon name="note" size={18} /><span className="muted">ref</span><span className="copy-text keep-case num">{stop.ref}</span><Copy text={stop.ref} label="copy ref" /></div>
        )}
        {safeUrl(stop.url) && <a href={safeUrl(stop.url)!} target="_blank" rel="noopener noreferrer" className="fact fact-link"><Icon name="link" size={18} /><span>{hostOf(stop.url)}</span></a>}
        {stop.notes && <p className="notes">{stop.notes}</p>}
      </div>

      <Related stop={stop} on={on} trips={trips} stops={stops} onClose={onClose} />

      {(stop.kind === 'place' || stop.kind === 'stay') && (
        <section className="inspiration" aria-label="links">
          <p className="mono-label">links</p>
          {inspiration.map((l) => (
            <a key={l.id} className="fact fact-link" href={safeUrl(l.url) ?? undefined} target="_blank" rel="noopener noreferrer"><SiteIcon url={l.url} /><span>{l.title || host(l.url)}</span></a>
          ))}
          {canEdit && <button type="button" className="text-link" onClick={() => setLinking(true)}>add a link →</button>}
          <Sheet page open={linking} title="save a link" onClose={() => setLinking(false)}>
            <CaptureForm initial={null} tripId={stop.trip_id} stopId={stop.id} onDone={() => setLinking(false)} />
          </Sheet>
        </section>
      )}

      {/* the booking's money: each cost a tap away from changing the amount, who paid or the split */}
      {(linked.length > 0 || canEdit) && (
        <div className="card-money">
          {linked.length > 0 && (
            <section className="money-rows" aria-label="money">
              <p className="mono-label">money</p>
              {linked.map((c) => {
                const words = <>
                  <Icon name="money" size={18} />
                  <span className="stack-xs cost-words">
                    {c.title && c.title !== stopTitle(stop) && <span>{c.title}</span>}
                    <span className={`num${c.title && c.title !== stopTitle(stop) ? ' muted' : ''}`}>{costLine(c, members)}</span>
                  </span>
                </>
                return canEdit
                  ? <button key={c.id} type="button" className="fact fact-cost" onClick={() => setCosting(c)}>{words}</button>
                  : <p key={c.id} className="fact">{words}</p>
              })}
            </section>
          )}
          {canEdit && <button type="button" className="text-link" onClick={() => setCosting('new')}>add a cost →</button>}
          {home && (
            <Sheet page open={!!costing} title={costing === 'new' ? 'new cost' : 'edit cost'} onClose={() => setCosting(null)}>
              {costing && (
                <CostForm key={costing === 'new' ? 'new' : costing.id} trip={home} cost={costing === 'new' ? undefined : costing} day={stop.day}
                  stopId={stop.id} defaults={{ title: stopTitle(stop), category: expenseCategory({ kind: stop.kind, category: stop.category }) }} onDone={() => setCosting(null)} />
              )}
            </Sheet>
          )}
        </div>
      )}

      {(stop.kind === 'place' || stop.kind === 'stay') && <Reviews stop={stop} />}

      <FilesSection stop={stop} canEdit={canEdit} pickerRef={picker} />

      {problem && <p className="warn-line" role="alert">{problem}</p>}
      <div className="row form-actions">
        <TwoTapDelete onConfirm={del} disabled={!canEdit} />
        <span className="spacer" />
        <Button variant="primary" disabled={!canEdit} onClick={onEdit}>edit</Button>
      </div>
    </div>
  )
}

function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}
