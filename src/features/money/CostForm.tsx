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
import { checkCost, costDraft, CostFields, costValues, type CostDraft } from '../stops/CostFields'

type Props = { trip: Trip; cost?: Cost; onDone: () => void }

type Draft = { id: string; title: string; category: string; date: string; money: CostDraft }

export function CostForm({ trip, cost, onDone }: Props) {
  const members = useMembers().data ?? []
  const rates = useRates().data ?? null
  const save = useSave('costs')
  const remove = useRemove('costs')
  const canEdit = useCanEdit()
  // a new cost is kept as a draft for this trip, with one id, so saving again after a failure sends the same row
  const [form, update, settle] = useDraft<Draft>(cost ? null : draftKey(trip.id, 'cost'), () => ({
    id: cost?.id ?? newId(), title: cost?.title ?? '', category: cost?.category ?? 'food', date: cost?.date ?? '',
    money: costDraft(cost, trip.currency, rates),
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
        ...(cost ? {} : { trip_id: trip.id, stop_id: null }),
        title: title.trim(), category, date: date || null, ...costValues(money)!,
      })
      onDone()
    })
  }

  return (
    <form id={formId} className="stack" onSubmit={submit} noValidate>
      <input className="title-input" aria-label="name" placeholder="name" value={title} onChange={(e) => set({ title: e.target.value })} autoFocus={!cost} />
      <CostFields value={money} onChange={(m) => set({ money: m })} members={members} rates={rates} />
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
