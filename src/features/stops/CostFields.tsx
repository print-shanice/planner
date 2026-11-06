import type { Cost, Member, StopKind } from '../../lib/types'
import type { Rates } from '../../lib/money'
import { currencyList } from '../../lib/rates'
import { useAuth } from '../../lib/auth'
import { Choice } from '../../components/Choice'

export type CostDraft = { amount: string; currency: string; other: boolean; code: string; rate: string; paid: boolean; paid_by: string; split: string }

export function costDraft(c: Cost | undefined, fallback: string, rates: Rates | null): CostDraft {
  const cur = c?.currency ?? fallback
  const known = currencyList(rates).includes(cur)
  return {
    amount: c ? String(c.amount) : '',
    currency: known ? cur : 'other',
    other: !known,
    code: known ? '' : cur,
    rate: c?.eur_rate != null ? String(c.eur_rate) : '',
    // paid and its payer always go together: an older estimate with a payer reads as not paid
    paid: c?.status === 'paid',
    paid_by: c?.status === 'paid' ? c.paid_by ?? '' : '',
    split: c?.split ?? 'even',
  }
}

export const COST_PROBLEMS = ['check the amount', 'enter a 3-letter currency code', 'pick who paid']

const num = (s: string) => Number(s.replace(',', '.').trim())

export function checkCost(d: CostDraft): string | null {
  if (!d.amount.trim()) return null
  const a = num(d.amount)
  if (!Number.isFinite(a) || a < 0) return 'check the amount'
  if (d.other && !/^[a-z]{3}$/i.test(d.code.trim())) return 'enter a 3-letter currency code'
  if (d.other && d.rate.trim() && !(num(d.rate) > 0)) return 'check the amount'
  if (d.paid && !d.paid_by) return 'pick who paid'
  return null
}

export function costValues(d: CostDraft) {
  if (!d.amount.trim()) return null
  return {
    amount: num(d.amount),
    currency: d.other ? d.code.trim().toUpperCase() : d.currency,
    eur_rate: d.other && d.rate.trim() ? num(d.rate) : null,
    paid_by: d.paid ? d.paid_by || null : null,
    split: d.split || 'even',
    status: (d.paid ? 'paid' : 'estimate') as Cost['status'],
  }
}

const PAYMENT = [{ value: false, label: 'not paid' }, { value: true, label: 'paid', tone: 'ok' as const }]

export const CATEGORY_OF: Record<StopKind, string> = { place: 'activities', stay: 'stays', journey: 'transport', note: 'other' }

type PaymentProps = { value: CostDraft; onChange: (d: CostDraft) => void; members: Member[] }

// paid or not paid; it sits at the top of wherever the cost is (the cost header, or under a cost's name).
// paid picks a payer straight away: you, or else the first member
export function PaymentChoice({ value: d, onChange, members }: PaymentProps) {
  const people = members.filter((m) => m.user_id)
  const me = useAuth().userId
  const pay = (paid: boolean) => onChange(paid
    ? { ...d, paid, paid_by: d.paid_by || (people.some((m) => m.user_id === me) ? me! : people[0]?.user_id ?? '') }
    : { ...d, paid })
  return <Choice label="payment" options={PAYMENT} value={d.paid} onChange={pay} />
}

type Props = { value: CostDraft; onChange: (d: CostDraft) => void; members: Member[]; rates: Rates | null }

export function CostFields({ value: d, onChange, members, rates }: Props) {
  const set = (p: Partial<CostDraft>) => onChange({ ...d, ...p })
  const people = members.filter((m) => m.user_id)
  return (
    <fieldset className="cost-fields">
      <div className="row">
        <label className="field">
          <span className="label">amount</span>
          <input inputMode="decimal" value={d.amount} onChange={(e) => set({ amount: e.target.value })} />
        </label>
        <label className="field currency-field">
          <span className="label">currency</span>
          <select value={d.other ? 'other' : d.currency} onChange={(e) => (e.target.value === 'other' ? set({ other: true, currency: 'other' }) : set({ other: false, currency: e.target.value }))}>
            {currencyList(rates).map((c) => <option key={c} value={c}>{c}</option>)}
            <option value="other">other…</option>
          </select>
        </label>
      </div>
      {d.other && (
        <div className="row">
          <label className="field">
            <span className="label">currency code</span>
            <input value={d.code} maxLength={3} autoCapitalize="characters" onChange={(e) => set({ code: e.target.value })} />
          </label>
          <label className="field">
            <span className="label">1 EUR =</span>
            <input inputMode="decimal" value={d.rate} onChange={(e) => set({ rate: e.target.value })} />
          </label>
        </div>
      )}
      <div className="row">
        {d.paid && (
          <label className="field">
            <span className="label">paid by</span>
            <select value={d.paid_by} onChange={(e) => set({ paid_by: e.target.value })}>
              {!d.paid_by && <option value="" />}
              {people.map((m) => <option key={m.user_id!} value={m.user_id!}>{(m.name || m.email).toLowerCase()}</option>)}
            </select>
          </label>
        )}
        <label className="field">
          <span className="label">for</span>
          <select value={d.split} onChange={(e) => set({ split: e.target.value })}>
            <option value="even">split evenly</option>
            {people.map((m) => <option key={m.user_id!} value={m.user_id!}>only for {(m.name || m.email).toLowerCase()}</option>)}
          </select>
        </label>
      </div>
    </fieldset>
  )
}
