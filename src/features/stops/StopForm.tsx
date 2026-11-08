import { useId, useState, type FormEvent } from 'react'
import type { Mode, Place, Stop, StopStatus, Trip } from '../../lib/types'
import { useCosts, useMembers, useRates, useRemove, useSave, useStops } from '../../lib/queries'
import { newId } from '../../lib/id'
import { hasPoint } from '../../lib/walk'
import { Fold } from '../../components/Fold'
import { Switch } from '../../components/Switch'
import { Pick } from '../../components/Pick'
import { Icon } from '../../components/Icon'
import { FormFooter, useSubmit } from '../../components/FormFooter'
import { draftKey, useDraft } from '../../lib/drafts'
import { PlaceField } from './PlaceField'
import { NamePlace } from './NamePlace'
import { CATEGORY_OF, checkCost, COST_PROBLEMS, costDraft, CostFields, costValues, PaymentChoice, type CostDraft } from './CostFields'
import { stopTitle } from '../plan/StopRow'

type Props = { stop: Stop; trip: Trip | undefined; isNew: boolean; onDone: () => void }

const MODES: Mode[] = ['flight', 'train', 'bus', 'ferry']

type Draft = {
  title: string; place: Place | null; day: string; time: string; end_date: string; end_time: string
  mode: Mode; origin: Place | null; destination: Place | null; status: StopStatus; ref: string; url: string; notes: string
}

function seed(s: Stop): Draft {
  return {
    title: s.title ?? '', place: s.place, day: s.day ?? '', time: s.time ?? '', end_date: s.end_date ?? '', end_time: s.end_time ?? '',
    mode: s.mode ?? 'train', origin: s.origin, destination: s.destination, status: s.status ?? 'idea',
    ref: s.ref ?? '', url: s.url ?? '', notes: s.notes ?? '',
  }
}

function toRow(d: Draft, kind: Stop['kind']): Partial<Stop> {
  const base: Partial<Stop> = {
    title: d.title.trim(), day: d.day || null, time: d.time || null, status: d.status,
    ref: d.ref.trim(), url: d.url.trim(), notes: d.notes,
  }
  if (kind === 'place') return { ...base, place: d.place, end_time: d.end_time || null }
  if (kind === 'stay') return { ...base, place: d.place, end_date: d.end_date || null, end_time: d.end_time || null }
  if (kind === 'journey') return { ...base, mode: d.mode, origin: d.origin, destination: d.destination, end_date: d.end_date || null, end_time: d.end_time || null }
  return { ...base, end_time: d.end_time || null }
}

function problemOf(d: Draft, kind: Stop['kind']): string | null {
  if (kind === 'journey') { if (!d.origin && !d.destination) return 'add where it starts or ends' }
  else if (!d.title.trim()) return 'add a name'
  if (kind === 'stay' && d.day && d.end_date && d.end_date < d.day) return 'check-out is before check-in'
  if ((kind === 'place' || kind === 'note') && d.end_time && (!d.time || d.end_time <= d.time)) return 'end time must be after start time'
  return null
}

export function StopForm({ stop, trip, isNew, onDone }: Props) {
  const allStops = useStops().data ?? []
  const members = useMembers().data ?? []
  const rates = useRates().data ?? null
  const save = useSave('stops')
  const saveCost = useSave('costs')
  const removeCost = useRemove('costs')
  const costs = useCosts().data
  // seeded once when the sheet opens; a realtime refresh never overwrites what is being typed
  const [linked] = useState(() => costs?.find((c) => c.stop_id === stop.id))
  // a new price keeps one id, so saving again after a failure sends the same cost
  const [costId] = useState(() => linked?.id ?? newId())
  const [initial] = useState(() => seed(stop))
  // a new stop's form is kept as a draft per trip and kind, with its id, until it's saved
  const [form, update, settle] = useDraft<{ id: string; d: Draft; cost: CostDraft }>(
    isNew ? draftKey(stop.trip_id, stop.kind) : null,
    () => ({ id: stop.id, d: initial, cost: costDraft(linked, trip?.currency ?? 'EUR', rates) }),
  )
  const { id, d, cost } = form
  const [problem, setProblem] = useState<string | null>(null)
  const [costReveal, setCostReveal] = useState(0)
  const { run, saving, failure } = useSubmit()
  const formId = useId()
  const set = (p: Partial<Draft>) => update((v) => ({ ...v, d: { ...v.d, ...p } }))
  const setCost = (c: CostDraft) => update((v) => ({ ...v, cost: c }))
  const near = hasPoint(d.place) ? { lat: d.place.lat!, lng: d.place.lng! } : hasPoint(trip?.base) ? { lat: trip!.base!.lat!, lng: trip!.base!.lng! } : null
  const kind = stop.kind

  function submit(e: FormEvent) {
    e.preventDefault()
    const draft = { ...d }
    if (kind === 'place' && !draft.title.trim() && draft.place) draft.title = draft.place.name
    const p = problemOf(draft, kind) ?? checkCost(cost)
    setProblem(p)
    if (p && COST_PROBLEMS.includes(p)) setCostReveal((n) => n + 1)
    if (p) return
    settle()
    void run(async () => {
      const row = toRow(draft, kind)
      const day = row.day ?? null
      const moved = isNew || day !== (stop.day ?? null)
      const position = moved
        ? Math.max(-1, ...allStops.filter((s) => s.trip_id === stop.trip_id && s.id !== id && (s.day ?? null) === day).map((s) => s.position)) + 1
        : stop.position
      if (isNew) {
        // an idea added from saved stays saved
        await save.mutateAsync({ ...row, id, trip_id: stop.trip_id, kind, position, ...(stop.saved ? { saved: true } : {}) })
      } else {
        const was = toRow(initial, kind) as Record<string, unknown>
        const changed: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(row)) if (JSON.stringify(v) !== JSON.stringify(was[k])) changed[k] = v
        if (moved) changed.position = position
        if (Object.keys(changed).length) await save.mutateAsync({ id, ...changed })
      }
      const values = costValues(cost)
      if (values) {
        await saveCost.mutateAsync({
          id: costId,
          trip_id: stop.trip_id, stop_id: id, title: stopTitle({ ...stop, ...row, id } as Stop),
          category: stop.category ?? CATEGORY_OF[kind], date: day, ...values,
        })
      } else if (linked) {
        await removeCost.mutateAsync(linked.id)
      }
      onDone()
    })
  }

  const set2 = set
  const when = (rows: [string, 'day' | 'end_date', 'time' | 'end_time' | null][]) => (
    <div className="when">
      {rows.map(([label, dk, tk]) => (
        <div key={label} className="when-row">
          <span className="when-label">{label}</span>
          <Pick type="date" label={label} value={d[dk]} onChange={(v) => set({ [dk]: v } as Partial<Draft>)} min={dk === 'end_date' ? d.day || undefined : undefined} />
          {tk && <Pick type="time" label={`${label} time`} value={d[tk]} onChange={(v) => set({ [tk]: v } as Partial<Draft>)} />}
        </div>
      ))}
    </div>
  )
  const q = (text: string) => <p className="form-q">{text}</p>
  const named = (label: string) => (
    <NamePlace label={label} name={d.title} place={d.place} near={near} autoFocus={isNew}
      onName={(title) => set2({ title })} onPlace={(p) => set2(p ? { place: p, title: p.name } : { place: null })} />
  )
  const link = <label className="field"><span className="label">link</span><input type="url" inputMode="url" value={d.url} onChange={(e) => set({ url: e.target.value })} /></label>
  const notes = <label className="field"><span className="label">notes</span><textarea value={d.notes} onChange={(e) => set({ notes: e.target.value })} /></label>
  const booked = d.status === 'booked'
  const ref = booked || !!d.ref.trim()
    ? <label className="field"><span className="label">booking ref</span><input value={d.ref} autoCapitalize="characters" onChange={(e) => set({ ref: e.target.value })} /></label>
    : null
  // booked or not: a switch; off means it still needs booking
  const bookedSwitch = <Switch label="booked" checked={booked} onChange={(v) => set({ status: v ? 'booked' : 'to_book' })} />
  const money = <CostFields value={cost} onChange={setCost} members={members} rates={rates}
    payment={<PaymentChoice value={cost} onChange={setCost} members={members} />} />

  return (
    <form id={formId} className="stack page-form" onSubmit={submit} noValidate>
      {kind === 'stay' && (<>
        {q('where are you staying?')}
        {named('name')}
        {q('when')}
        {when([['check-in', 'day', 'time'], ['check-out', 'end_date', 'end_time']])}
        {q('booking')}
        {bookedSwitch}
        {ref}
        {q('cost')}
        {money}
        <div className="folds"><Fold label="more" open={!!d.url.trim() || !!d.notes.trim()}>{link}{notes}</Fold></div>
      </>)}
      {kind === 'place' && (<>
        {q('what are you doing?')}
        {named('name')}
        {q('when')}
        {when([['day', 'day', 'time']])}
        {q('tickets')}
        <Switch label="needs booking" checked={d.status !== 'idea'} onChange={(v) => set({ status: v ? (booked ? 'booked' : 'to_book') : 'idea' })} />
        {d.status !== 'idea' && <Switch label="booked" checked={booked} onChange={(v) => set({ status: v ? 'booked' : 'to_book' })} />}
        {ref}
        <div className="folds">
          <Fold label="more" open={!!cost.amount.trim() || cost.paid || !!d.url.trim() || !!d.notes.trim() || !!d.end_time} reveal={costReveal}>
            <Pick type="time" label="end time" value={d.end_time} onChange={v => set({ end_time: v })} />
            {money}{link}{notes}
          </Fold>
        </div>
      </>)}
      {kind === 'journey' && (<>
        {q('how')}
        <div className="segmented modes" role="group" aria-label="mode">
          {MODES.map((m) => <button key={m} type="button" aria-pressed={d.mode === m} onClick={() => set({ mode: m })}><Icon name={m === 'flight' ? 'plane' : m} size={20} /><span>{m}</span></button>)}
        </div>
        {q('route')}
        <div className="route">
          <PlaceField id={`from-${id}`} label="from" value={d.origin} near={near} onChange={(p) => set({ origin: p })} />
          <PlaceField id={`to-${id}`} label="to" value={d.destination} near={near} onChange={(p) => set({ destination: p })} />
        </div>
        {q('when')}
        {when([['depart', 'day', 'time'], ['arrive', 'end_date', 'end_time']])}
        {q('booking')}
        {bookedSwitch}
        {booked && <label className="field"><span className="label">carrier / number</span><input value={d.title} onChange={(e) => set({ title: e.target.value })} /></label>}
        {ref}
        <div className="folds">
          <Fold label="more" open={!!cost.amount.trim() || cost.paid || !!d.url.trim() || !!d.notes.trim()} reveal={costReveal}>{money}{link}{notes}</Fold>
        </div>
      </>)}
      {kind === 'note' && (<>
        <input className="title-input" aria-label="title" placeholder="title" value={d.title} onChange={(e) => set({ title: e.target.value })} autoFocus={isNew} />
        <textarea className="note-text" aria-label="notes" placeholder="write it down" value={d.notes} onChange={(e) => set({ notes: e.target.value })} />
        {q('when')}
        {when([['day', 'day', 'time']])}
        <div className="folds"><Fold label="more" open={!!d.url.trim() || !!d.end_time}>
          <Pick type="time" label="end time" value={d.end_time} onChange={v => set({ end_time: v })} />{link}
        </Fold></div>
      </>)}
      <FormFooter form={formId} problem={problem ?? failure} saving={saving} failed={!!failure} />
    </form>
  )
}
