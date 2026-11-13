import { useState, type FormEvent } from 'react'
import type { Cost, Trip } from '../../lib/types'
import { useMembers, useRates, useSave } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { newId } from '../../lib/id'
import { formatMoney } from '../../lib/money'
import { useToast } from '../../components/Toast'
import { checkCost, costDraft, costValues } from '../stops/CostFields'

// a cost typed straight into money: a name and an amount make an estimate in the trip's currency, shared by
// everyone. who paid, the split and the kind are set by tapping it in the list
export function AddCost({ trip }: { trip: Trip }) {
  const save = useSave<Cost>('costs')
  const people = (useMembers().data ?? []).map((m) => m.user_id).filter((x): x is string => !!x)
  const rates = useRates().data ?? null
  const canEdit = useCanEdit()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  if (!canEdit) return null

  function add(e: FormEvent) {
    e.preventDefault()
    const base = costDraft(undefined, trip.currency, rates, people)
    // a currency without a live rate is still the trip's own
    const money = { ...base, amount, ...(base.other ? { code: trip.currency } : {}) }
    const wrong = !amount.trim() ? 'check the amount' : checkCost(money)
    const values = wrong ? null : costValues(money, people)
    if (!values || !(values.amount > 0)) { setProblem(wrong ?? 'check the amount'); return }
    setProblem(null)
    const name = title.trim()
    save.mutateAsync({ id: newId(), trip_id: trip.id, stop_id: null, title: name, category: 'other', date: null, ...values })
      .catch(() => { /* the row stays with "couldn't save" and a retry */ })
    toast.show({ text: `added ${[name, formatMoney(values.amount, values.currency)].filter(Boolean).join(' · ')}` })
    setTitle(''); setAmount('')
  }

  return (
    <div className="add-cost">
      <form className="jot" onSubmit={add}>
        <input type="text" aria-label="add a cost" placeholder="add a cost…" value={title} autoComplete="off" enterKeyHint="next"
          onChange={(e) => { setProblem(null); setTitle(e.target.value) }} />
        <input type="text" className="jot-amount num" aria-label="amount" placeholder={trip.currency.toLowerCase()} value={amount} inputMode="decimal" autoComplete="off" enterKeyHint="done"
          onChange={(e) => { setProblem(null); setAmount(e.target.value) }} />
        <button type="submit" className="btn small line-go" aria-label="add cost" disabled={!title.trim() && !amount.trim()}>add</button>
      </form>
      {problem && <p role="alert" className="warn-line">{problem}</p>}
    </div>
  )
}
