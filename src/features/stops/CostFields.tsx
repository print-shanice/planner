import type { Cost, Member, StopKind } from '../../lib/types'
import type { Rates } from '../../lib/money'
import { currencyList } from '../../lib/rates'
import { useAuth } from '../../lib/auth'
import type { CSSProperties, ReactNode } from 'react'
import { Switch } from '../../components/Switch'
import { colourVar } from '../../lib/colors'
import { Help, Tooltip } from '../../components/Tooltip'

export type SplitMode = 'even' | 'some' | 'amounts'
export type CostDraft = {
  amount: string; currency: string; other: boolean; code: string; rate: string; paid: boolean; paid_by: string
  // who it's for: everyone, some people, or exact amounts each
  mode: SplitMode; among: string[]; shares: Record<string, string>
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x))

// people: the members who can share a cost (they've signed in), in order
export function costDraft(c: Cost | undefined, fallback: string, rates: Rates | null, people: string[] = []): CostDraft {
  const cur = c?.currency ?? fallback
  const known = currencyList(rates).includes(cur)
  const amounts = c?.split_amounts && Object.keys(c.split_amounts).length ? c.split_amounts : null
  const among = c?.split_among?.length ? c.split_among : c?.split && c.split !== 'even' ? [c.split] : null
  const mode: SplitMode = amounts ? 'amounts' : among && !(people.length && sameSet(among, people)) ? 'some' : 'even'
  return {
    amount: c ? String(c.amount) : '',
    currency: known ? cur : 'other',
    other: !known,
    code: known ? '' : cur,
    rate: c?.eur_rate != null ? String(c.eur_rate) : '',
    // paid and its payer always go together: an older estimate with a payer reads as not paid
    paid: c?.status === 'paid',
    paid_by: c?.status === 'paid' ? c.paid_by ?? '' : '',
    mode,
    among: among ?? [],
    shares: amounts ? Object.fromEntries(Object.entries(amounts).map(([k, v]) => [k, String(v)])) : {},
  }
}

export const COST_PROBLEMS = ['check the amount', 'enter a 3-letter currency code', 'pick who paid', "pick who it's for", "doesn't add up"]

const num = (s: string) => Number(s.replace(',', '.').trim())

export function checkCost(d: CostDraft): string | null {
  if (!d.amount.trim()) return null
  const a = num(d.amount)
  if (!Number.isFinite(a) || a < 0) return 'check the amount'
  if (d.other && !/^[a-z]{3}$/i.test(d.code.trim())) return 'enter a 3-letter currency code'
  if (d.other && d.rate.trim() && !(num(d.rate) > 0)) return 'check the amount'
  if (d.paid && !d.paid_by) return 'pick who paid'
  if (d.mode === 'some' && !d.among.length) return "pick who it's for"
  if (d.mode === 'amounts') {
    const sum = Object.values(d.shares).reduce((t, v) => t + (v.trim() ? num(v) : 0), 0)
    if (!Number.isFinite(sum) || Math.abs(sum - a) > 0.009) return "doesn't add up"
  }
  return null
}

// people: who "everyone" is right now; it's written down so someone joining later never shares this cost
export function costValues(d: CostDraft, people: string[]) {
  if (!d.amount.trim()) return null
  const among = d.mode === 'even' ? people : d.mode === 'some' ? people.filter((p) => d.among.includes(p)).concat(d.among.filter((p) => !people.includes(p)))
    : people.filter((p) => d.shares[p]?.trim() && num(d.shares[p]) > 0)
  return {
    amount: num(d.amount),
    currency: d.other ? d.code.trim().toUpperCase() : d.currency,
    eur_rate: d.other && d.rate.trim() ? num(d.rate) : null,
    paid_by: d.paid ? d.paid_by || null : null,
    split: d.mode === 'some' && among.length === 1 ? among[0] : 'even',
    split_among: among,
    split_amounts: d.mode === 'amounts' ? Object.fromEntries(among.map((p) => [p, num(d.shares[p])])) : null,
    status: (d.paid ? 'paid' : 'estimate') as Cost['status'],
  }
}


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
  return <Switch label="paid already" checked={d.paid} onChange={pay} help="include this cost in paid spending and shared balances" />
}

const MODES: [SplitMode, string][] = [['even', 'everyone'], ['some', 'some people'], ['amounts', 'amounts']]
const SPLIT_HELP: Record<SplitMode, string> = {
  even: 'split equally between all current travellers',
  some: 'split equally between the people you select',
  amounts: 'enter each person’s share of the total',
}
const who = (m: Member) => (m.name || m.email).toLowerCase()

// payment: the paid switch, shown between the amount and who paid
type Props = { value: CostDraft; onChange: (d: CostDraft) => void; members: Member[]; rates: Rates | null; payment?: ReactNode; autoFocus?: boolean }

export function CostFields({ value: d, onChange, members, rates, payment, autoFocus }: Props) {
  const set = (p: Partial<CostDraft>) => onChange({ ...d, ...p })
  const people = members.filter((m) => m.user_id)
  return (
    <fieldset className="cost-fields">
      <div className="row amount-row">
        <label className="field">
          <span className="label">amount</span>
          <input inputMode="decimal" placeholder="0" autoFocus={autoFocus} value={d.amount} onChange={(e) => set({ amount: e.target.value })} />
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
      {d.other && <div className="help-row"><p className="muted note-line">example: enter 1.50 if €1 buys 1.50 units.</p><Help label="about the exchange rate">enter how many units of this currency equal one euro</Help></div>}
      {payment}
      <div className="row">
        {d.paid && (
          // who paid: tap a face
          <div className="stack-xs"><span className="label">paid by {people.find(m => m.user_id === d.paid_by) ? who(people.find(m => m.user_id === d.paid_by)!) : '…'}</span><div className="faces" role="group" aria-label="paid by">
            {people.map((m) => (
              <Tooltip key={m.user_id!} text={`paid by ${who(m)}`}><button type="button" className="face" aria-label={(m.name || m.email).toLowerCase()} aria-pressed={d.paid_by === m.user_id}
                onClick={() => set({ paid_by: m.user_id! })} style={{ '--c': colourVar(m.color) } as CSSProperties}>
                <span className="avatar">{(m.name || m.email).slice(0, 1)}</span>
              </button></Tooltip>
            ))}
          </div></div>
        )}
      </div>
      <div className="split-for" role="group" aria-label="split">
        <span className="label help-label">split<Help label="about splitting costs">{SPLIT_HELP[d.mode]}</Help></span>
        <div className="segmented">
          {MODES.map(([m, l]) => <Tooltip key={m} text={SPLIT_HELP[m]}><button type="button" aria-pressed={d.mode === m} onClick={() => set({ mode: m })}>{l}</button></Tooltip>)}
        </div>
        {d.mode === 'some' && (
          <div className="faces">
            {people.map((m) => (
              <Tooltip key={m.user_id!} text={`for ${who(m)}`}><button type="button" className="face" aria-label={`for ${who(m)}`} aria-pressed={d.among.includes(m.user_id!)}
                onClick={() => set({ among: d.among.includes(m.user_id!) ? d.among.filter((x) => x !== m.user_id) : [...d.among, m.user_id!] })}
                style={{ '--c': colourVar(m.color) } as CSSProperties}>
                <span className="avatar">{who(m).slice(0, 1)}</span>
              </button></Tooltip>
            ))}
          </div>
        )}
        {d.mode === 'amounts' && (
          <div className="shares">
            {people.map((m) => (
              <label key={m.user_id!} className="field">
                <span className="label">{`${who(m)}'s share`}</span>
                <input inputMode="decimal" placeholder="0" value={d.shares[m.user_id!] ?? ''}
                  onChange={(e) => set({ shares: { ...d.shares, [m.user_id!]: e.target.value } })} />
              </label>
            ))}
          </div>
        )}
      </div>
    </fieldset>
  )
}
