import type { Cost, Member, StopKind } from '../../lib/types'
import type { Rates } from '../../lib/money'
import { currencyList } from '../../lib/rates'

export type CostDraft = { amount: string; currency: string; other: boolean; code: string; rate: string; paid_by: string; split: string }

export function costDraft(c: Cost | undefined, fallback: string, rates: Rates | null): CostDraft {
  const cur = c?.currency ?? fallback
  const known = currencyList(rates).includes(cur)
  return {
    amount: c ? String(c.amount) : '',
    currency: known ? cur : 'other',
    other: !known,
    code: known ? '' : cur,
    rate: c?.eur_rate != null ? String(c.eur_rate) : '',
    paid_by: c?.paid_by ?? '',
    split: c?.split ?? 'even',
  }
}

const num = (s: string) => Number(s.replace(',', '.').trim())

export function checkCost(d: CostDraft): string | null {
  if (!d.amount.trim()) return null
  const a = num(d.amount)
  if (!Number.isFinite(a) || a < 0) return 'check the amount'
  if (d.other && !/^[a-z]{3}$/i.test(d.code.trim())) return 'enter a 3-letter currency code'
  if (d.other && d.rate.trim() && !(num(d.rate) > 0)) return 'check the amount'
  return null
}

export function costValues(d: CostDraft) {
  if (!d.amount.trim()) return null
  return {
    amount: num(d.amount),
    currency: d.other ? d.code.trim().toUpperCase() : d.currency,
    eur_rate: d.other && d.rate.trim() ? num(d.rate) : null,
    paid_by: d.paid_by || null,
    split: d.split || 'even',
    status: (d.paid_by ? 'paid' : 'estimate') as Cost['status'],
  }
}

export const CATEGORY_OF: Record<StopKind, string> = { place: 'activities', stay: 'stays', journey: 'transport', note: 'other' }

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
        <label className="field">
          <span className="label">paid by</span>
          <select value={d.paid_by} onChange={(e) => set({ paid_by: e.target.value })}>
            <option value="">not set</option>
            {people.map((m) => <option key={m.user_id!} value={m.user_id!}>{(m.name || m.email).toLowerCase()}</option>)}
          </select>
        </label>
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
