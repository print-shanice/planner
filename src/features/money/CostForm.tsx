import { useId, useState, type FormEvent } from 'react'
import type { Cost, Trip } from '../../lib/types'
import { useMembers, useRates, useRemove, useSave } from '../../lib/queries'
import { newId } from '../../lib/id'
import { CATEGORIES } from '../../lib/money'
import { useCanEdit } from '../../lib/offline'
import { draftKey, useDraft } from '../../lib/drafts'
import { FormFooter, useSubmit } from '../../components/FormFooter'
import { TwoTapDelete } from '../../components/TwoTapDelete'
import { Pick } from '../../components/Pick'
import { checkCost, costDraft, CostFields, costValues, PaymentChoice, type CostDraft } from '../stops/CostFields'

// stopId: a new cost attached to a booking (named after it unless told otherwise); edits keep the cost's own stop
type Props = { trip: Trip; cost?: Cost; day?: string | null; stopId?: string | null; defaults?: { title?: string; category?: string }; onDone: () => void }

type Draft = { id: string; title: string; category: string; date: string; money: CostDraft }

export function CostForm({ trip, cost, day, stopId = null, defaults, onDone }: Props) {
  const members = useMembers().data ?? []
  const people = members.map((m) => m.user_id).filter((x): x is string => !!x)
  const rates = useRates().data ?? null
  const save = useSave('costs')
  const remove = useRemove('costs')
  const canEdit = useCanEdit()
  // a new cost is kept as a draft for this trip, with one id, so saving again after a failure sends the same row
  const [form, update, settle] = useDraft<Draft>(cost ? null : draftKey(trip.id, stopId ? `cost:${stopId}` : 'cost'), () => ({
    id: cost?.id ?? newId(), title: cost?.title ?? defaults?.title ?? '', category: cost?.category ?? defaults?.category ?? 'food', date: cost?.date ?? day ?? '',
    money: costDraft(cost, trip.currency, rates, people),
  }))
  const { id, title, category, date, money } = form
  const set = (p: Partial<Draft>) => update((v) => ({ ...v, ...p }))
  const [problem, setProblem] = useState<string | null>(null)
  const { run, saving, failure } = useSubmit()
  const formId = useId()

  function submit(e: FormEvent) {
    e.preventDefault()
    const p = !title.trim() ? 'add a name' : !money.amount.trim() ? 'check the amount' : checkCost(money)
    setProblem(p)
    if (p) return
    settle()
    void run(async () => {
      await save.mutateAsync({
        id,
        ...(cost ? {} : { trip_id: trip.id, stop_id: stopId }),
        title: title.trim(), category, date: date || null, ...costValues(money, people)!,
      })
      onDone()
    })
  }

  return (
    <form id={formId} className="stack page-form" onSubmit={submit} noValidate>
      <p className="form-q">how much?</p>
      <CostFields value={money} onChange={(m) => set({ money: m })} members={members} rates={rates} autoFocus={!cost}
        payment={<PaymentChoice value={money} onChange={(m) => set({ money: m })} members={members} />} />
      <p className="form-q">for</p>
      <input className="title-input" aria-label="name" placeholder="what was it?" value={title} onChange={(e) => set({ title: e.target.value })} />
      <p className="form-q">kind and day</p>
      <label className="field">
        <span className="label">category</span>
        <select value={category} onChange={(e) => set({ category: e.target.value })}>
          {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <div className="when">
        <div className="when-row"><span className="when-label">date</span><Pick type="date" label="date" value={date} onChange={(v) => set({ date: v })} /></div>
      </div>
      <FormFooter form={formId} problem={problem ?? failure} saving={saving} failed={!!failure}>
        {cost && <TwoTapDelete disabled={!canEdit} onConfirm={async () => { await remove.mutateAsync(cost.id); onDone() }} />}
      </FormFooter>
    </form>
  )
}
