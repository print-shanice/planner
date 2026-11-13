import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Cost, Member, Stop, StopStatus } from '../../lib/types'
import { useCosts, useFiles, useLinks, useMembers, useRemove, useSave, useTrips } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { formatMoney } from '../../lib/money'
import { splitLine } from '../../lib/settle'
import { gmapsUrl, directionsUrl } from '../../lib/gmaps'
import { supabase } from '../../lib/supabase'
import { hostOf, safeUrl } from '../../lib/embed'
import { Icon } from '../../components/Icon'
import { Copy } from '../../components/Copy'
import { TwoTapDelete } from '../../components/TwoTapDelete'
import { Pending } from '../../components/Pending'
import { FilesSection, filesOf } from './FilesSection'
import { Reviews } from './Reviews'
import { saveError } from '../../lib/errors'
import { stopTitle } from '../plan/stopText'
import { FlightCheck } from './FlightFacts'
import { statusWord } from '../../lib/flight'
import { Sheet } from '../../components/Sheet'
import { CaptureForm } from '../capture/CaptureForm'
import { CostForm } from '../money/CostForm'
import { PlaceDetails } from './PlaceDetails'
import { expenseCategory } from '../../lib/categories'
import { SiteIcon } from '../saved/LinkCard'
import { useSettle } from '../itinerary/useSettle'
import { CardTimes } from './CardTimes'
import { useSaveNote } from '../../lib/saveNote'
import { MODES, modeWord } from '../../lib/lineKind'
import { dayLabel } from '../../lib/dates'

function costLine(c: Cost, members: Member[]) {
  const who = (id: string | null) => members.find((m) => m.user_id === id)?.name
  const parts = [formatMoney(c.amount, c.currency)]
  parts.push(c.status === 'paid' ? (c.paid_by ? `paid by ${who(c.paid_by) ?? 'someone'}` : 'paid') : 'not paid')
  parts.push(splitLine(c, members))
  return parts.join(' · ')
}

type Props = { stop: Stop; onEdit: () => void; onClose: () => void }

// words written straight on the card, saved when you leave them (enter too, for one line)
function TextField({ label, value, onSave, disabled, multi, mono }: { label: string; value: string; onSave: (v: string) => void; disabled?: boolean; multi?: boolean; mono?: boolean }) {
  const [v, setV] = useState(value)
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  useEffect(() => { if (document.activeElement !== ref.current) setV(value) }, [value])
  const done = () => { const t = multi ? v : v.trim(); if (t !== value) onSave(t) }
  const common = {
    ref, 'data-quiet': '', 'aria-label': label, placeholder: '—', value: v, disabled, autoComplete: 'off',
    className: `card-field${mono ? ' mono keep-case' : ''}`, onBlur: done,
  }
  return multi
    ? <textarea {...common} rows={2} onChange={(e) => setV(e.target.value)} />
    : <input {...common} type="text" onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }} />
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <><dt className="mono-label">{label}</dt><dd>{children}</dd></>
}

// a stop's card is its form: its times big at the top, then its own fields as rows you change right there.
// the day it's on, its trip and the rest of the day aren't repeated: the plan beside it shows them
export function StopView({ stop, onEdit, onClose }: Props) {
  const canEdit = useCanEdit()
  const trips = useTrips().data ?? []
  const costs = useCosts().data ?? []
  const files = useFiles().data
  const members = useMembers().data ?? []
  const save = useSave('stops')
  const remove = useRemove('stops')
  const settle = useSettle()
  const [problem, setProblem] = useState<string | null>(null)
  const [linking, setLinking] = useState(false)
  const [saving, track] = useSaveNote()
  // a cost being changed on the card, or 'new' for one being added to this booking
  const [costing, setCosting] = useState<Cost | 'new' | null>(null)
  const inspiration = (useLinks().data ?? []).filter((l) => l.stop_id === stop.id)
  const picker = useRef<{ open: () => void }>(null)
  // every cost attached to this booking (a deposit and a balance can be two), oldest first
  const linked = costs.filter((c) => c.stop_id === stop.id).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
  const maps = stop.kind === 'journey' ? gmapsUrl(stop) : directionsUrl(stop.place)
  const directionsLabel = stop.kind === 'journey' && stop.mode === 'flight' ? 'to departure airport' : 'directions'
  const address = stop.place ? [stop.place.name, stop.place.address].filter(Boolean).join(', ') : ''
  const home = trips.find((t) => t.id === stop.trip_id)

  async function run(fn: () => Promise<unknown>) {
    setProblem(null)
    try { await fn() } catch (e) { setProblem(saveError(e)) }
  }

  // one change from the card; a new time also writes down the day's order, like a typed line
  const put = (changes: Partial<Stop>) => run(async () => {
    if ('time' in changes) settle({ ...stop, ...changes })
    await track(save.mutateAsync({ id: stop.id, ...changes }))
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

  // without a spot on the map there's nothing to give directions to; the card offers to add one instead
  const spot = [stop.place, stop.destination, stop.origin].some((p) => p != null && Number.isFinite(p.lat) && Number.isFinite(p.lng))

  const what = stop.kind === 'journey' ? modeWord(stop.mode) : stop.kind === 'place' ? stop.category ?? 'place' : stop.kind
  const kicker = `${what} · ${stop.day ? dayLabel(stop.day) : 'no date'}`
  const statuses: [StopStatus, string][] = stop.kind === 'note'
    ? [['to_book', 'to do'], ['booked', 'done']]
    : [['idea', 'idea'], ['to_book', 'to book'], ['booked', 'booked']]
  // a to-do tapped again goes back to being a plain note
  const pickStatus = (s: StopStatus) => {
    const to = stop.kind === 'note' && stop.status === s ? 'idea' : s
    if (to !== stop.status) put({ status: to })
  }
  const flight = stop.kind === 'journey' && stop.mode === 'flight'
  // how a looked-up flight is going ("landed", "delayed · leaves 16:45") reads in its label
  const word = flight && stop.flight ? statusWord(stop.flight) : null

  return (
    <div className="stack stop-view card">
      <p className="card-kicker mono-label">{kicker}{word && <> · <span className={word.warn ? 'warn-line' : undefined}>{word.text}</span></>}</p>
      {stop.place?.gid && <PlaceDetails place={stop.place} day={stop.day} />}
      <CardTimes stop={stop} canEdit={canEdit} put={put} />

      <div className="card-actions" role="group" aria-label="actions">
        {maps
          ? <a className="card-link" href={maps} target="_blank" rel="noopener noreferrer">{directionsLabel}</a>
          : <button type="button" className="card-link" disabled>{directionsLabel}</button>}
      </div>

      <dl className="card-rows">
        {stop.kind === 'journey' && (
          <Row label="how">
            <span className="card-options" role="group" aria-label="how">
              {MODES.map((m) => (
                <button key={modeWord(m)} type="button" aria-pressed={stop.mode === m} disabled={!canEdit} onClick={() => { if (stop.mode !== m) put({ mode: m }) }}>{modeWord(m)}</button>
              ))}
            </span>
          </Row>
        )}
        {stop.kind === 'journey' && (
          <Row label={flight ? 'flight' : 'name'}>
            <span className="card-line">
              <TextField label={flight ? 'flight number' : 'name'} value={stop.title} disabled={!canEdit} mono={flight} onSave={(title) => put({ title })} />
              {flight && canEdit && <button type="button" className="card-link" onClick={onEdit}>look up</button>}
              {flight && <FlightCheck stop={stop} />}
            </span>
          </Row>
        )}
        {stop.kind === 'place' && <Row label="kind"><button type="button" className="card-plain" disabled={!canEdit} onClick={onEdit}>{stop.category ?? 'place'}</button></Row>}
        {(stop.kind === 'place' || stop.kind === 'stay' || !spot) && stop.kind !== 'note' && (
          <Row label="where">
            {address && stop.kind !== 'journey'
              ? <span className="card-line"><span className="copy-text">{address}</span><Copy text={address} label="copy address" /></span>
              : canEdit ? <button type="button" className="card-link" onClick={onEdit}>add a location</button> : <span className="muted">—</span>}
          </Row>
        )}
        <Row label="status">
          <span className="card-options status" role="group" aria-label="status">
            {statuses.map(([s, word]) => (
              <button key={s} type="button" className={s === 'booked' ? 'ok' : s === 'to_book' ? 'warn' : ''} aria-pressed={stop.status === s}
                disabled={!canEdit} onClick={() => pickStatus(s)}>{word}</button>
            ))}
          </span>
        </Row>
        {stop.kind !== 'note' && (
          <Row label="ref">
            <span className="card-line">
              <TextField label="ref" value={stop.ref ?? ''} disabled={!canEdit} mono onSave={(ref) => put({ ref })} />
              {stop.ref && <Copy text={stop.ref} label="copy ref" />}
            </span>
          </Row>
        )}
        {safeUrl(stop.url) && <Row label="link"><a className="card-link" href={safeUrl(stop.url)!} target="_blank" rel="noopener noreferrer">{hostOf(stop.url)}</a></Row>}
        {(linked.length > 0 || canEdit) && (
          <Row label="cost">
            {/* the booking's money: each cost a tap away from changing the amount, who paid or the split */}
            {linked.length > 0 && (
              <section className="money-rows" aria-label="money">
                {linked.map((c) => {
                  const words = <span className="stack-xs cost-words">
                    {c.title && c.title !== stopTitle(stop) && <span>{c.title}</span>}
                    <span className={`num${c.title && c.title !== stopTitle(stop) ? ' muted' : ''}`}>{costLine(c, members)}</span>
                  </span>
                  return canEdit
                    ? <button key={c.id} type="button" className="card-plain fact-cost" onClick={() => setCosting(c)}>{words}</button>
                    : <p key={c.id} className="card-plain">{words}</p>
                })}
              </section>
            )}
            {canEdit && <button type="button" className="card-link" onClick={() => setCosting('new')}>add a cost</button>}
          </Row>
        )}
        {(stop.kind === 'place' || stop.kind === 'stay') && (inspiration.length > 0 || canEdit) && (
          <Row label="links">
            <section className="inspiration" aria-label="links">
              {inspiration.map((l) => (
                <a key={l.id} className="card-plain" href={safeUrl(l.url) ?? undefined} target="_blank" rel="noopener noreferrer"><SiteIcon url={l.url} /><span>{l.title || hostOf(l.url)}</span></a>
              ))}
              {canEdit && <button type="button" className="card-link" onClick={() => setLinking(true)}>add a link</button>}
            </section>
          </Row>
        )}
        {(canEdit || (files ?? []).some((f) => f.stop_id === stop.id)) && (
          <Row label={stop.kind === 'note' ? 'files' : 'tickets'}>
            <FilesSection stop={stop} canEdit={canEdit} pickerRef={picker} />
            {canEdit && <button type="button" className="card-link" onClick={() => picker.current?.open()}>{stop.kind === 'note' ? 'attach a file' : 'attach a ticket'}</button>}
          </Row>
        )}
        <Row label="notes"><TextField label="notes" value={stop.notes ?? ''} disabled={!canEdit} multi onSave={(notes) => put({ notes })} /></Row>
      </dl>

      {(stop.kind === 'place' || stop.kind === 'stay') && <Reviews stop={stop} />}

      {home && (
        <Sheet page open={!!costing} title={costing === 'new' ? 'new cost' : 'edit cost'} onClose={() => setCosting(null)}>
          {costing && (
            <CostForm key={costing === 'new' ? 'new' : costing.id} trip={home} cost={costing === 'new' ? undefined : costing} day={stop.day}
              stopId={stop.id} defaults={{ title: stopTitle(stop), category: expenseCategory({ kind: stop.kind, category: stop.category }) }} onDone={() => setCosting(null)} />
          )}
        </Sheet>
      )}
      <Sheet page open={linking} title="save a link" onClose={() => setLinking(false)}>
        <CaptureForm initial={null} tripId={stop.trip_id} stopId={stop.id} onDone={() => setLinking(false)} />
      </Sheet>

      {problem && <p className="warn-line" role="alert">{problem}</p>}
      <div className="card-foot">
        <TwoTapDelete onConfirm={del} disabled={!canEdit} />
        <span className="spacer" />
        {saving === 'saving' && <Pending label="saving" />}
        {saving === 'saved' && <span className="mono muted card-saved" role="status"><Icon name="check" size={15} />saved</span>}
        <button type="button" className="card-link" disabled={!canEdit} onClick={onEdit}>edit</button>
      </div>
    </div>
  )
}
