import { useMemo, useState } from 'react'
import type { Cost, Trip } from '../../lib/types'
import { useCosts, useMembers, useRates, useTrips } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { useAuth } from '../../lib/auth'
import { CATEGORIES, convert, formatMoney, totals } from '../../lib/money'
import { currencyList } from '../../lib/rates'
import { balances, transfers } from '../../lib/settle'
import { descendants } from '../../lib/countries'
import { fmtDay } from '../../lib/dates'
import { loadState } from '../../lib/load'
import { EmptyState } from '../../components/EmptyState'
import { LoadState } from '../../components/States'
import { Pill } from '../../components/Pill'
import { Sheet } from '../../components/Sheet'
import { useStopSheet } from '../stops/StopSheet'
import { CostForm } from './CostForm'
import { SaveFailed } from '../../components/SaveFailed'

const LABEL = Object.fromEntries(CATEGORIES)

export function MoneyTab({ trip }: { trip: Trip }) {
  const canEdit = useCanEdit()
  const tq = useTrips()
  const cq = useCosts()
  const trips = tq.data ?? []
  const allCosts = cq.data ?? []
  const load = loadState(tq, cq)
  const members = useMembers().data ?? []
  const rates = useRates().data ?? null
  const { userId } = useAuth()
  const sheet = useStopSheet()
  const [cur, setCur] = useState(trip.currency || 'EUR')
  const [editing, setEditing] = useState<Cost | null>(null)

  const ids = useMemo(() => new Set(descendants(trip.id, trips)), [trip.id, trips])
  const costs = useMemo(() => allCosts.filter((c) => ids.has(c.trip_id)), [allCosts, ids])
  const t = totals(costs, cur, rates)
  const total = t.paid + t.planned
  const budget = trip.budget != null ? convert(trip.budget, trip.currency, cur, rates) : null
  const scale = Math.max(total, budget ?? 0) || 1
  const over = budget != null && total > budget + 0.004 ? total - budget : 0
  const kids = trips.filter((x) => x.parent_id === trip.id)
  const name = (id: string) => (id === userId ? 'you' : members.find((m) => m.user_id === id)?.name || 'someone')

  const settle = useMemo(() => {
    const paid = costs.filter((c) => c.status === 'paid' && c.paid_by)
    if (!paid.length) return null
    const people = members.map((m) => m.user_id).filter((x): x is string => !!x)
    return transfers(balances(paid, people, rates))
  }, [costs, members, rates])

  if (load.state !== 'ready') return <LoadState load={load} blocks={2} />

  const sorted = [...costs].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.title.localeCompare(b.title))
  const show = (v: number) => formatMoney(v, cur)

  return (
    <div className="money stack">
      <LoadState load={load} />
      <div className="money-head">
        <div className="stack-xs">
          <p className="money-total num head" data-testid="money-total">{show(total)}</p>
          <p className="muted">{budget != null ? `of ${show(budget)} budget` : 'in total'}</p>
        </div>
        <select aria-label="show in" className="input cur-select" value={cur} onChange={(e) => setCur(e.target.value)}>
          {currencyList(rates).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {total > 0 && (
        <div className="budget-bar" aria-hidden="true">
          <span className="paid" style={{ width: `${(t.paid / scale) * 100}%` }} />
          <span className="planned" style={{ width: `${(t.planned / scale) * 100}%` }} />
        </div>
      )}
      {total > 0 && (
        <div className="legend muted">
          <span><i className="key paid" />paid {show(t.paid)}</span>
          <span><i className="key planned" />planned {show(t.planned)}</span>
        </div>
      )}
      {over > 0 && <p className="warn-line">over by {show(over)}</p>}

      {costs.length === 0 && <EmptyState title="no costs yet" />}

      {Object.keys(t.byCategory).length > 0 && (
        <section className="block" aria-label="by category">
          <h3 className="head">by category</h3>
          <ul className="list">
            {CATEGORIES.filter(([k]) => t.byCategory[k]).map(([k, l]) => (
              <li key={k}><span>{l}</span><span className="num">{show(t.byCategory[k].paid + t.byCategory[k].planned)}</span></li>
            ))}
            {Object.keys(t.byCategory).filter((k) => !LABEL[k]).map((k) => (
              <li key={k}><span>{k}</span><span className="num">{show(t.byCategory[k].paid + t.byCategory[k].planned)}</span></li>
            ))}
          </ul>
        </section>
      )}

      {kids.length > 0 && costs.length > 0 && (
        <section className="block" aria-label="by trip">
          <h3 className="head">by trip</h3>
          <ul className="list">
            {[trip, ...kids].map((x) => {
              const mine = x.id === trip.id ? costs.filter((c) => c.trip_id === trip.id) : costs.filter((c) => descendants(x.id, trips).includes(c.trip_id))
              const s = totals(mine, cur, rates)
              return <li key={x.id}><span><span className="dot" style={{ background: `var(--g${(x.color ?? 0) % 6})` }} />{x.name}</span><span className="num">{show(s.paid + s.planned)}</span></li>
            })}
          </ul>
        </section>
      )}

      {settle && (
        <section className="block" aria-label="settle up">
          <h3 className="head">settle up</h3>
          {settle.length === 0
            ? <p className="muted">all square</p>
            : <ul className="list">{settle.map((x) => <li key={`${x.from}-${x.to}`}><span>{`${name(x.from)} ${x.from === userId ? 'owe' : 'owes'} ${name(x.to)} ${show(convert(x.eur, 'EUR', cur, rates) ?? x.eur)}`}</span></li>)}</ul>}
        </section>
      )}

      {sorted.length > 0 && (
        <section className="block" aria-label="all costs">
          <h3 className="head">all costs</h3>
          <ul className="list costs">
            {sorted.map((c) => (
              <li key={c.id}>
                <button type="button" className="cost-row" onClick={() => (c.stop_id && sheet ? sheet.openStop(c.stop_id) : setEditing(c))}>
                  <span className="cost-name">
                    <span>{c.title || LABEL[c.category] || c.category}</span>
                    <span className="muted">{[c.date ? fmtDay(c.date) : null, LABEL[c.category] ?? c.category].filter(Boolean).join(' · ')}</span>
                  </span>
                  {c.status === 'paid' && <Pill status="paid" />}
                  <span className="num">{formatMoney(c.amount, c.currency)}</span>
                </button>
                <SaveFailed table="costs" id={c.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {rates && <p className="footnote muted">{`ecb rates, ${fmtDay(rates.date)}`}{t.leftOut > 0 ? ` · ${t.leftOut} not converted` : ''}</p>}

      <Sheet open={!!editing} title="edit cost" onClose={() => setEditing(null)}>
        {editing && <CostForm key={editing.id} trip={trip} cost={editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </div>
  )
}
