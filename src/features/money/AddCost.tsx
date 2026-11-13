import { useState, type FormEvent } from 'react'
import type { Cost, Trip } from '../../lib/types'
import { useMembers, useRates, useSave } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { newId } from '../../lib/id'
import { formatMoney } from '../../lib/money'
import { currencyList } from '../../lib/rates'
import { useToast } from '../../components/Toast'
import { checkCost, costDraft, costValues } from '../stops/CostFields'

// a cost typed straight into money: a name, an amount and its currency (the trip's to start with, kept for the next one)
// make an estimate shared by everyone. who paid, the split and the kind are set by tapping it in the list
export function AddCost({ trip }: { trip: Trip }) {
  const save = useSave<Cost>('costs')
  const people = (useMembers().data ?? []).map((m) => m.user_id).filter((x): x is string => !!x)
  const rates = useRates().data ?? null
  const canEdit = useCanEdit()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState(trip.currency)
  const [problem, setProblem] = useState<string | null>(null)
  if (!canEdit) return null
  // the trip's own currency first, even without a live rate, then the rest
  const choices = [trip.currency, ...currencyList(rates).filter((c) => c !== trip.currency)]

  function add(e: FormEvent) {
    e.preventDefault()
    const base = costDraft(undefined, currency, rates, people)
    // a currency without a live rate is still the one picked
    const money = { ...base, amount, ...(base.other ? { code: currency } : {}) }
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
      {/* three boxes, each plainly its own field, the currency picked like "show in" above */}
      <form className="cost-line" onSubmit={add}>
        <input type="text" className="input cost-name-in" aria-label="add a cost" placeholder="add a cost…" value={title} autoComplete="off" enterKeyHint="next"
          onChange={(e) => { setProblem(null); setTitle(e.target.value) }} />
        <input type="text" className="input cost-amount-in num" aria-label="amount" placeholder="0" value={amount} inputMode="decimal" autoComplete="off" enterKeyHint="done"
          onChange={(e) => { setProblem(null); setAmount(e.target.value) }} />
        <select className="input cur-select" aria-label="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {choices.map((c) => <option key={c} value={c}>{c.toLowerCase()}</option>)}
        </select>
        <button type="submit" className="btn small line-go" aria-label="add cost" disabled={!title.trim() && !amount.trim()}>add</button>
      </form>
      {problem && <p role="alert" className="warn-line">{problem}</p>}
    </div>
  )
}
