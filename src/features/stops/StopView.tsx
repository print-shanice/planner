import { useRef, useState, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Cost, Member, Stop } from '../../lib/types'
import { useCosts, useFiles, useMembers, useRemove, useSave, useStops, useTrips } from '../../lib/queries'
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
import { TwoTapDelete } from '../../components/TwoTapDelete'
import { FilesSection, filesOf } from './FilesSection'
import { Reviews } from './Reviews'
import { saveError } from '../../lib/errors'
import { stopSub } from '../plan/StopRow'

const day = (d: string | null, t?: string | null) => (d ? [fmtDay(d, { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', ''), t].filter(Boolean).join(' · ') : t ?? '')

function Copy({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  async function copy(e: MouseEvent<HTMLButtonElement>) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const el = e.currentTarget.parentElement?.querySelector('.copy-text')
      if (el) { const r = document.createRange(); r.selectNodeContents(el); const sel = getSelection(); sel?.removeAllRanges(); sel?.addRange(r) }
    }
    setDone(true)
    setTimeout(() => setDone(false), 1500)
  }
  return <button type="button" className="icon-btn" aria-label={label} onClick={copy}><Icon name={done ? 'check' : 'copy'} size={18} /></button>
}

function costLine(c: Cost, members: Member[]) {
  const who = (id: string | null) => members.find((m) => m.user_id === id)?.name
  const parts = [formatMoney(c.amount, c.currency)]
  parts.push(c.status === 'paid' ? (c.paid_by ? `paid by ${who(c.paid_by) ?? 'someone'}` : 'paid') : 'not paid')
  parts.push(c.split === 'even' ? 'split evenly' : `only for ${who(c.split) ?? 'one'}`)
  return parts.join(' · ')
}

type Props = { stop: Stop; onEdit: () => void; onClose: () => void }

export function StopView({ stop, onEdit, onClose }: Props) {
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
  const [moving, setMoving] = useState(false)
  const picker = useRef<{ open: () => void }>(null)
  const navigate = useNavigate()
  const linked = costs.find((c) => c.stop_id === stop.id)
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

  const moveDay = (d: string) => run(async () => {
    const last = Math.max(-1, ...stops.filter((s) => s.trip_id === stop.trip_id && s.day === d && s.id !== stop.id).map((s) => s.position))
    const change: Partial<Stop> & { id: string } = { id: stop.id, day: d, position: last + 1 }
    if (stop.end_date && stop.day) change.end_date = addDays(stop.end_date, daysBetween(stop.day, d))
    await save.mutateAsync(change)
  })

  const moveTrip = (tripId: string) => run(async () => {
    await save.mutateAsync({ id: stop.id, trip_id: tripId })
    if (linked) await saveCost.mutateAsync({ id: linked.id, trip_id: tripId })
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

  return (
    <div className="stack stop-view">
      {(stop.status !== 'idea' || what) && (
        <div className="stop-kicker">
          {stop.status !== 'idea' && <Pill status={stop.status} />}
          {what && <p className="muted">{what}</p>}
        </div>
      )}
      <div className="stop-actions" role="group" aria-label="actions">
        <button type="button" className="stop-action" onClick={showOnMap}><span className="ico"><Icon name="map" /></span>map</button>
        {maps
          ? <a className="stop-action" href={maps} target="_blank" rel="noopener noreferrer"><span className="ico"><Icon name="ext" /></span>directions</a>
          : <button type="button" className="stop-action" disabled><span className="ico"><Icon name="ext" /></span>directions</button>}
        <button type="button" className="stop-action" aria-expanded={moving} disabled={!canEdit} onClick={() => setMoving(!moving)}><span className="ico"><Icon name="calendar" /></span>move</button>
        <button type="button" className="stop-action" disabled={!canEdit} onClick={() => picker.current?.open()}><span className="ico"><Icon name="upload" /></span>ticket</button>
      </div>

      {moving && canEdit && (
        <div className="move">
          {stop.day && siblings.length > 1 && (
            <div className="row">
              <button type="button" className="btn ghost small" disabled={at <= 0} onClick={() => shift(at - 1)}><Icon name="up" size={18} /><span>earlier</span></button>
              <button type="button" className="btn ghost small" disabled={at >= siblings.length - 1} onClick={() => shift(at + 1)}><Icon name="down" size={18} /><span>later</span></button>
            </div>
          )}
          <label className="field">
            <span className="label">move to another day</span>
            <input type="date" value={stop.day ?? ''} onChange={(e) => { if (e.target.value && e.target.value !== stop.day) moveDay(e.target.value) }} />
          </label>
          <label className="field">
            <span className="label">move to another trip</span>
            <select value={stop.trip_id} onChange={(e) => { if (e.target.value !== stop.trip_id) moveTrip(e.target.value) }}>
              {[...trips].sort((a, b) => a.name.localeCompare(b.name)).map((t) => <option key={t.id} value={t.id}>{t.name.toLowerCase()}</option>)}
            </select>
          </label>
        </div>
      )}

      <div className="facts">
        {facts.filter(Boolean).map((f) => <p key={f} className="fact"><Icon name="calendar" size={18} /><span>{f}</span></p>)}
        {address && stop.kind !== 'journey' && (
          <div className="fact fact-copy"><Icon name="pin" size={18} /><span className="copy-text">{address}</span><Copy text={address} label="copy address" /></div>
        )}
        {linked && <p className="fact num"><Icon name="money" size={18} /><span>{costLine(linked, members)}</span></p>}
        {stop.ref && (
          <div className="fact fact-copy"><Icon name="note" size={18} /><span className="muted">ref</span><span className="copy-text keep-case num">{stop.ref}</span><Copy text={stop.ref} label="copy ref" /></div>
        )}
        {safeUrl(stop.url) && <a href={safeUrl(stop.url)!} target="_blank" rel="noopener noreferrer" className="fact fact-link"><Icon name="link" size={18} /><span>{hostOf(stop.url)}</span></a>}
        {stop.notes && <p className="notes">{stop.notes}</p>}
      </div>

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
