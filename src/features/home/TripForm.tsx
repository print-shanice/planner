import { useMemo, useState, type FormEvent } from 'react'
import { useRates, useRemove, useSave, useTrips } from '../../lib/queries'
import { currencyList } from '../../lib/rates'
import { descendants } from '../../lib/countries'
import type { Place, Trip } from '../../lib/types'
import { Button } from '../../components/Button'
import { TwoTapDelete } from '../../components/TwoTapDelete'

type Props = { trip?: Trip; parentId?: string | null; onDone: () => void; onDeleted?: () => void }

const SWATCHES = [0, 1, 2, 3, 4, 5]

export function TripForm({ trip, parentId = null, onDone, onDeleted }: Props) {
  const trips = useTrips().data ?? []
  const rates = useRates().data ?? null
  const save = useSave('trips')
  const remove = useRemove('trips')

  const [name, setName] = useState(trip?.name ?? '')
  const [start, setStart] = useState(trip?.start_date ?? '')
  const [end, setEnd] = useState(trip?.end_date ?? '')
  const [budget, setBudget] = useState(trip?.budget != null ? String(trip.budget) : '')
  const [currency, setCurrency] = useState(trip?.currency ?? (trips.find((t) => t.id === parentId)?.currency ?? 'EUR'))
  const [base, setBase] = useState(trip?.base?.name ?? '')
  const [color, setColor] = useState(trip?.color ?? (trips.filter((t) => t.parent_id === parentId).length % 6))
  const [notes, setNotes] = useState(trip?.notes ?? '')
  const [parent, setParent] = useState<string | null>(trip ? trip.parent_id : parentId)
  const [problem, setProblem] = useState<string | null>(null)

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

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    if (start && end && end < start) { setProblem('ends before it starts'); return }
    setProblem(null)
    const keepBase = trip?.base && trip.base.name === base.trim()
    const nextBase: Place | null = base.trim() ? (keepBase ? trip!.base : { name: base.trim(), lat: null, lng: null }) : null
    await save.mutateAsync({
      ...(trip ? { id: trip.id } : {}),
      name: name.trim(),
      start_date: start || null,
      end_date: end || (start || null),
      budget: budget.trim() === '' ? null : Number(budget),
      currency,
      base: nextBase,
      color,
      notes,
      parent_id: parent,
    })
    onDone()
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <label className="field">
        <span className="label">name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus={!trip} />
      </label>
      <div className="row">
        <label className="field">
          <span className="label">starts</span>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="field">
          <span className="label">ends</span>
          <input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>
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
      <label className="field">
        <span className="label">home base</span>
        <input value={base} onChange={(e) => setBase(e.target.value)} />
      </label>
      <div className="field" role="radiogroup" aria-label="colour">
        <span className="label">colour</span>
        <div className="swatches">
          {SWATCHES.map((i) => (
            <button key={i} type="button" role="radio" aria-checked={color === i} aria-label={`colour ${i + 1}`}
              className="swatch" style={{ background: `var(--g${i})` }} onClick={() => setColor(i)} />
          ))}
        </div>
      </div>
      {trip && (
        <label className="field">
          <span className="label">part of</span>
          <select value={parent ?? ''} onChange={(e) => setParent(e.target.value || null)}>
            <option value="">none</option>
            {parentChoices.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
      )}
      <label className="field">
        <span className="label">notes</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {problem && <p className="warn-line">{problem}</p>}
      <div className="row form-actions">
        {trip && (
          <TwoTapDelete label="delete trip" disabled={hasChildren}
            onConfirm={async () => { await remove.mutateAsync(trip.id); (onDeleted ?? onDone)() }} />
        )}
        <span className="spacer" />
        <Button variant="primary" type="submit" disabled={save.isPending}>save</Button>
      </div>
      {hasChildren && <p className="warn-line">move or delete its side trips first</p>}
    </form>
  )
}
