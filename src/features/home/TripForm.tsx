import { useId, useMemo, useState, type FormEvent } from 'react'
import { useRates, useRemove, useSave, useTrips } from '../../lib/queries'
import { currencyList } from '../../lib/rates'
import { descendants } from '../../lib/countries'
import { newId } from '../../lib/id'
import type { Place, Trip } from '../../lib/types'
import { Fold } from '../../components/Fold'
import { Pick } from '../../components/Pick'
import { FormFooter, useSubmit } from '../../components/FormFooter'
import { TwoTapDelete } from '../../components/TwoTapDelete'
import { PlaceField } from '../stops/PlaceField'
import { COLOUR_NAMES, PICKER_ORDER, colourIndex, colourVar } from '../../lib/colors'

type Props = { trip?: Trip; parentId?: string | null; onDone: () => void; onDeleted?: () => void }


export function TripForm({ trip, parentId = null, onDone, onDeleted }: Props) {
  const trips = useTrips().data ?? []
  const rates = useRates().data ?? null
  const save = useSave('trips')
  const remove = useRemove('trips')

  // a new trip keeps one id, so saving again after a failure sends the same row
  const [id] = useState(() => trip?.id ?? newId())
  const [name, setName] = useState(trip?.name ?? '')
  const [start, setStart] = useState(trip?.start_date ?? '')
  const [end, setEnd] = useState(trip?.end_date ?? '')
  const [budget, setBudget] = useState(trip?.budget != null ? String(trip.budget) : '')
  const [currency, setCurrency] = useState(trip?.currency ?? (trips.find((t) => t.id === parentId)?.currency ?? 'EUR'))
  const [base, setBase] = useState<Place | null>(trip?.base ?? null)
  const [color, setColor] = useState(trip?.color ?? colourIndex(trips.filter((t) => t.parent_id === parentId).length))
  const [notes, setNotes] = useState(trip?.notes ?? '')
  const [parent, setParent] = useState<string | null>(trip ? trip.parent_id : parentId)
  const [problem, setProblem] = useState<string | null>(null)
  const { run, saving, failure } = useSubmit()
  const formId = useId()

  const currencies = useMemo(() => {
    const list = currencyList(rates)
    return list.includes(currency) ? list : [currency, ...list]
  }, [rates, currency])

  const parentChoices = useMemo(() => {
    if (!trip) return []
    const banned = new Set([trip.id, ...descendants(trip.id, trips)])
    return trips.filter((t) => !banned.has(t.id)).sort((a, b) => a.name.localeCompare(b.name))
  }, [trip, trips])

  const hasChildren = !!trip && trips.some((t) => t.parent_id === trip.id)

  function submit(e: FormEvent) {
    e.preventDefault()
    const p = !name.trim() ? 'add a name' : start && end && end < start ? 'ends before it starts' : null
    setProblem(p)
    if (p) return
    void run(async () => {
      await save.mutateAsync({
        id,
        name: name.trim(),
        start_date: start || null,
        end_date: end || (start || null),
        budget: budget.trim() === '' ? null : Number(budget),
        currency,
        base,
        color,
        notes,
        parent_id: parent,
      })
      onDone()
    })
  }

  return (
    <form id={formId} className="stack page-form" onSubmit={submit} noValidate>
      <input className="title-input" aria-label="name" placeholder="name the trip" value={name} onChange={(e) => setName(e.target.value)} required autoFocus={!trip} />
      <p className="form-q">when</p>
      <div className="when">
        <div className="when-row"><span className="when-label">starts</span><Pick type="date" label="starts" value={start} onChange={setStart} /></div>
        <div className="when-row"><span className="when-label">ends</span><Pick type="date" label="ends" value={end} min={start || undefined} onChange={setEnd} /></div>
      </div>
      <p className="form-q">based in</p>
      <PlaceField id={`base-${id}`} label="home base" value={base} onChange={setBase} />
      <p className="form-q">colour</p>
      <div className="swatches" role="radiogroup" aria-label="colour">
        {PICKER_ORDER.map((i) => (
          <button key={i} type="button" role="radio" aria-checked={colourIndex(color) === i} aria-label={COLOUR_NAMES[i]}
            className="swatch" style={{ background: colourVar(i) }} onClick={() => setColor(i)} />
        ))}
      </div>
      <div className="folds">
        <Fold label="budget, notes & trip details" open={budget.trim() !== '' || !!notes.trim()}>
          <div className="row">
            <label className="field">
              <span className="label">budget</span>
              <input type="number" inputMode="decimal" min="0" step="any" value={budget} onChange={(e) => setBudget(e.target.value)} />
            </label>
            <label className="field currency-field">
              <span className="label">currency</span>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
          {trip && (
            <label className="field">
              <span className="label">part of</span>
              <select value={parent ?? ''} onChange={(e) => setParent(e.target.value || null)}>
                <option value="">none</option>
                {parentChoices.map((t) => <option key={t.id} value={t.id}>{t.name.toLowerCase()}</option>)}
              </select>
            </label>
          )}
          <label className="field">
            <span className="label">notes</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </Fold>
      </div>
      {hasChildren && <p className="warn-line">move or delete its side trips first</p>}
      <FormFooter form={formId} problem={problem ?? failure} saving={saving} failed={!!failure}>
        {trip && (
          <TwoTapDelete label="delete trip" disabled={hasChildren}
            onConfirm={async () => { await remove.mutateAsync(trip.id); (onDeleted ?? onDone)() }} />
        )}
      </FormFooter>
    </form>
  )
}
