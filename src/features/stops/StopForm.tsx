import { useId, useState, type FormEvent } from 'react'
import type { Mode, Place, Stop, StopStatus, Trip } from '../../lib/types'
import { useCosts, useMembers, useRates, useRemove, useSave, useStops } from '../../lib/queries'
import { newId } from '../../lib/id'
import { hasPoint } from '../../lib/walk'
import { Fold } from '../../components/Fold'
import { FormFooter, useSubmit } from '../../components/FormFooter'
import { draftKey, useDraft } from '../../lib/drafts'
import { PlaceField } from './PlaceField'
import { CATEGORY_OF, checkCost, COST_PROBLEMS, costDraft, CostFields, costValues, type CostDraft } from './CostFields'
import { stopTitle } from '../plan/StopRow'

type Props = { stop: Stop; trip: Trip | undefined; isNew: boolean; onDone: () => void }

const MODES: Mode[] = ['flight', 'train', 'bus', 'ferry']
const STATUSES: [StopStatus, string][] = [['idea', 'idea'], ['to_book', 'to book'], ['booked', 'booked']]

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
  if (kind === 'place') return { ...base, place: d.place }
  if (kind === 'stay') return { ...base, place: d.place, end_date: d.end_date || null, end_time: d.end_time || null }
  if (kind === 'journey') return { ...base, mode: d.mode, origin: d.origin, destination: d.destination, end_date: d.end_date || null, end_time: d.end_time || null }
  return base
}

function problemOf(d: Draft, kind: Stop['kind']): string | null {
  if (kind === 'journey') { if (!d.origin && !d.destination) return 'add where it starts or ends' }
  else if (!d.title.trim()) return 'add a name'
  if (kind === 'stay' && d.day && d.end_date && d.end_date < d.day) return 'check-out is before check-in'
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
        await save.mutateAsync({ ...row, id, trip_id: stop.trip_id, kind, position })
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

  const nameField = (label: string) => (
    <label className="field">
      <span className="label">{label}</span>
      <input value={d.title} onChange={(e) => set({ title: e.target.value })} autoFocus={isNew} />
    </label>
  )
  const dateTime = (dl: string, dk: 'day' | 'end_date', tl: string, tk: 'time' | 'end_time') => (
    <div className="row">
      <label className="field"><span className="label">{dl}</span><input type="date" value={d[dk]} onChange={(e) => set({ [dk]: e.target.value } as Partial<Draft>)} /></label>
      <label className="field time-field"><span className="label">{tl}</span><input type="time" value={d[tk]} onChange={(e) => set({ [tk]: e.target.value } as Partial<Draft>)} /></label>
    </div>
  )
  const placeField = (
    <PlaceField id={`loc-${id}`} label="location" value={d.place} near={near}
      onChange={(p) => set({ place: p, ...(p && !d.title.trim() ? { title: p.name } : {}) })} />
  )
  const link = <label className="field"><span className="label">link</span><input type="url" inputMode="url" value={d.url} onChange={(e) => set({ url: e.target.value })} /></label>
  const notes = <label className="field"><span className="label">notes</span><textarea value={d.notes} onChange={(e) => set({ notes: e.target.value })} /></label>

  return (
    <form id={formId} className="stack" onSubmit={submit} noValidate>
      {kind === 'place' && (<>
        {nameField('name')}
        {placeField}
        {dateTime('day', 'day', 'time', 'time')}
      </>)}
      {kind === 'stay' && (<>
        {nameField('name')}
        {placeField}
        {dateTime('check-in', 'day', 'check-in time', 'time')}
        {dateTime('check-out', 'end_date', 'check-out time', 'end_time')}
      </>)}
      {kind === 'journey' && (<>
        <div className="segmented" role="group" aria-label="mode">
          {MODES.map((m) => <button key={m} type="button" aria-pressed={d.mode === m} onClick={() => set({ mode: m })}>{m}</button>)}
        </div>
        <PlaceField id={`from-${id}`} label="from" value={d.origin} near={near} onChange={(p) => set({ origin: p })} />
        <PlaceField id={`to-${id}`} label="to" value={d.destination} near={near} onChange={(p) => set({ destination: p })} />
        {dateTime('depart', 'day', 'depart time', 'time')}
        {dateTime('arrive', 'end_date', 'arrive time', 'end_time')}
      </>)}
      {kind === 'note' && (<>
        {nameField('title')}
        <label className="field"><span className="label">day</span><input type="date" value={d.day} onChange={(e) => set({ day: e.target.value })} /></label>
        {notes}
      </>)}

      <div className="folds">
        <Fold label="booking" open={d.status !== 'idea' || !!d.ref.trim() || (kind === 'journey' && !!d.title.trim())}>
          <div className="segmented" role="group" aria-label="status">
            {STATUSES.map(([v, l]) => <button key={v} type="button" aria-pressed={d.status === v} onClick={() => set({ status: v })}>{l}</button>)}
          </div>
          {kind === 'journey' && (
            <label className="field"><span className="label">carrier / number</span><input value={d.title} onChange={(e) => set({ title: e.target.value })} /></label>
          )}
          <label className="field"><span className="label">booking ref</span><input value={d.ref} autoCapitalize="characters" onChange={(e) => set({ ref: e.target.value })} /></label>
        </Fold>
        <Fold label="cost" open={!!cost.amount.trim()} reveal={costReveal}>
          <CostFields value={cost} onChange={setCost} members={members} rates={rates} />
        </Fold>
        {kind === 'note'
          ? <Fold label="link" open={!!d.url.trim()}>{link}</Fold>
          : <Fold label="notes & links" open={!!d.url.trim() || !!d.notes.trim()}>{link}{notes}</Fold>}
      </div>
      <FormFooter form={formId} problem={problem ?? failure} saving={saving} failed={!!failure} />
    </form>
  )
}
