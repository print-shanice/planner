import { useState, type FormEvent } from 'react'
import type { Cost, Trip } from '../../lib/types'
import { useMembers, useRates, useRemove, useSave } from '../../lib/queries'
import { newId } from '../../lib/id'
import { CATEGORIES } from '../../lib/money'
import { useCanEdit } from '../../lib/offline'
import { Button } from '../../components/Button'
import { TwoTapDelete } from '../../components/TwoTapDelete'
import { checkCost, costDraft, CostFields, costValues } from '../stops/CostFields'
import { saveError } from '../stops/errors'

type Props = { trip: Trip; cost?: Cost; onDone: () => void }

export function CostForm({ trip, cost, onDone }: Props) {
  const members = useMembers().data ?? []
  const rates = useRates().data ?? null
  const save = useSave('costs')
  const remove = useRemove('costs')
  const canEdit = useCanEdit()
  // a new cost keeps one id, so saving again after a failure sends the same row
  const [id] = useState(() => cost?.id ?? newId())
  const [title, setTitle] = useState(cost?.title ?? '')
  const [category, setCategory] = useState(cost?.category ?? 'food')
  const [date, setDate] = useState(cost?.date ?? '')
  const [status, setStatus] = useState<Cost['status']>(cost?.status ?? 'estimate')
  const [money, setMoney] = useState(() => costDraft(cost, trip.currency, rates))
  const [problem, setProblem] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setProblem('add a name'); return }
    if (!money.amount.trim()) { setProblem('check the amount'); return }
    const p = checkCost(money)
    if (p) { setProblem(p); return }
    const v = costValues(money)!
    try {
      await save.mutateAsync({
        id,
        ...(cost ? {} : { trip_id: trip.id, stop_id: null }),
        title: title.trim(), category, date: date || null, ...v, status,
      })
      onDone()
    } catch (err) {
      setProblem(saveError(err))
    }
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <label className="field"><span className="label">name</span><input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={!cost} /></label>
      <CostFields value={money} onChange={setMoney} members={members} rates={rates} />
      <div className="row">
        <label className="field">
          <span className="label">category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="field"><span className="label">date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      </div>
      <div className="segmented" role="group" aria-label="status">
        {(['estimate', 'paid'] as const).map((s) => <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)}>{s}</button>)}
      </div>
      {problem && <p className="warn-line" role="alert">{problem}</p>}
      <div className="row form-actions">
        {cost && <TwoTapDelete disabled={!canEdit} onConfirm={async () => { await remove.mutateAsync(cost.id); onDone() }} />}
        <span className="spacer" />
        <Button variant="primary" type="submit" disabled={!canEdit}>save</Button>
      </div>
    </form>
  )
}
