import { useMemo, useState } from 'react'
import type { Cost, Trip } from '../../lib/types'
import { useCosts, useMembers, useRates, useRemove, useSave, useTrips } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { useAuth } from '../../lib/auth'
import { CATEGORIES, convert, formatMoney, totals } from '../../lib/money'
import { currencyList } from '../../lib/rates'
import { balances, isPayback, transfers } from '../../lib/settle'
import { ancestors, descendants } from '../../lib/countries'
import { fmtDay, todayISO } from '../../lib/dates'
import { newId } from '../../lib/id'
import { loadState } from '../../lib/load'
import { EmptyState } from '../../components/EmptyState'
import { LoadState } from '../../components/States'
import { Pill } from '../../components/Pill'
import { Sheet } from '../../components/Sheet'
import { useStopSheet } from '../stops/StopSheet'
import { CostForm } from './CostForm'
import { SaveFailed } from '../../components/SaveFailed'
import { Pending } from '../../components/Pending'
import { TwoTapDelete } from '../../components/TwoTapDelete'

const LABEL = Object.fromEntries(CATEGORIES)

export function MoneyTab({ trip }: { trip: Trip }) {
  const canEdit = useCanEdit()
  const tq = useTrips()
  const cq = useCosts()
  const trips = tq.data ?? []
  const allCosts = cq.data ?? []
  const load = loadState(tq, cq)
  const members = useMembers().data ?? []
  const rq = useRates()
  const rates = rq.data ?? null
  const { userId } = useAuth()
  const sheet = useStopSheet()
  const [cur, setCur] = useState(trip.currency || 'EUR')
  const [editing, setEditing] = useState<Cost | null>(null)
  const [withKids, setWithKids] = useState(true)

  const kids = trips.filter((x) => x.parent_id === trip.id)
  const scoped = withKids || !kids.length
  const ids = useMemo(() => new Set(scoped ? descendants(trip.id, trips) : [trip.id]), [trip.id, trips, scoped])
  const costs = useMemo(() => allCosts.filter((c) => ids.has(c.trip_id)), [allCosts, ids])
  const t = totals(costs, cur, rates)
  const total = t.paid + t.planned
  const budget = trip.budget != null ? convert(trip.budget, trip.currency, cur, rates) : null
  const scale = Math.max(total, budget ?? 0) || 1
  const over = budget != null && total > budget + 0.004 ? total - budget : 0
  const name = (id: string | null) => (id === userId ? 'you' : members.find((m) => m.user_id === id)?.name || 'someone')
  const owes = (id: string) => (id === userId ? 'owe' : 'owes')
  const payBack = (x: { from: string; to: string; eur: number }) => save.mutateAsync({
    id: newId(), trip_id: top.id, stop_id: null, title: '', category: 'repayment', status: 'paid', date: todayISO(),
    paid_by: x.from, split: x.to, split_among: [x.to], split_amounts: null, amount: x.eur, currency: 'EUR', eur_rate: null,
  }).catch(() => { /* "couldn't save" shows on the row */ })

  const save = useSave('costs')
  const remove = useRemove('costs')
  // people settle once for the whole trip, side trips and all, whichever of them you're looking at
  const top = ancestors(trip.id, trips)[0] ?? trip
  const settle = useMemo(() => {
    const family = new Set(descendants(top.id, trips))
    const paid = allCosts.filter((c) => family.has(c.trip_id) && c.status === 'paid' && c.paid_by)
    if (!paid.length) return null
    const people = members.map((m) => m.user_id).filter((x): x is string => !!x)
    const bal = balances(paid, people, rates)
    return { bal: Object.entries(bal).filter(([, v]) => Math.abs(v) > 0.005).sort((a, b) => b[1] - a[1]), moves: transfers(bal) }
  }, [allCosts, top.id, trips, members, rates])

  if (load.state !== 'ready') return <LoadState load={load} blocks={2} />

  const sorted = [...costs].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.title.localeCompare(b.title))
  const show = (v: number) => formatMoney(v, cur, { whole: true })
  const left = budget != null && !over ? budget - total : null

  return (
    <div className="money stack">
      <LoadState load={load} />
      {kids.length > 0 && (
        <div className="segmented money-scope" role="group" aria-label="covers">
          <button type="button" aria-pressed={!withKids} onClick={() => setWithKids(false)}>this trip</button>
          <button type="button" aria-pressed={withKids} onClick={() => setWithKids(true)}>with side trips</button>
        </div>
      )}
      <div className="money-head">
        <div className="stack-xs">
          <p className="money-total num head" data-testid="money-total">{show(total)}</p>
          <p className="muted num">{budget != null ? [`of ${show(budget)}`, left != null ? `${show(left)} left` : ''].filter(Boolean).join(' · ') : 'in total'}</p>
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
      {over > 0 && <p className="warn-line">{show(over)} over budget</p>}

      {settle && (
        <section className="settle-box" aria-label="settle up">
          <p className="label">settle up</p>
          {settle.moves.length === 0 ? <p className="settle-line"><Pill status="settled" /></p> : <>
            {settle.bal.length > 2 && <ul className="settle-people">
              {settle.bal.map(([id, v]) => (
                <li key={id} className="num">{`${name(id)} · ${v > 0 ? 'owed' : owes(id)} ${show(convert(Math.abs(v), 'EUR', cur, rates) ?? Math.abs(v))}`}</li>
              ))}
            </ul>}
            {settle.moves.map((x) => {
              const line = `${name(x.from)} ${owes(x.from)} ${name(x.to)} ${show(convert(x.eur, 'EUR', cur, rates) ?? x.eur)}`
              return (
                <div key={`${x.from}-${x.to}`} className="settle-move">
                  <p className="settle-line num">{line}</p>
                  {canEdit && <button type="button" className="btn ghost small" aria-label={`paid back: ${line}`} onClick={() => payBack(x)}>paid back</button>}
                </div>
              )
            })}
          </>}
        </section>
      )}

      {costs.length === 0 && <EmptyState title="no costs yet" />}

      {scoped && kids.length > 0 && costs.length > 0 && (
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

      {sorted.length > 0 && (
        <section className="block" aria-label="all costs">
          <h3 className="head">all costs</h3>
          <ul className="list costs">
            {sorted.map((c) => isPayback(c) ? (
              // a pay-back only squares up: it reads as who paid whom, and can only be removed
              <li key={c.id}>
                <div className="cost-row payback">
                  <span className="cost-name">
                    <span>{`${name(c.paid_by)} paid ${name(c.split_among?.[0] ?? c.split)} back`}</span>
                    {c.date && <span className="muted">{fmtDay(c.date)}</span>}
                  </span>
                  <span className="num">{formatMoney(c.amount, c.currency)}</span>
                  <TwoTapDelete disabled={!canEdit} onConfirm={() => remove.mutateAsync(c.id)} />
                </div>
                <SaveFailed table="costs" id={c.id} />
              </li>
            ) : (
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

      {!rates && rq.isLoading && <p className="footnote"><Pending label="loading rates" /></p>}
      {rates && <p className="footnote muted">{`ecb rates, ${fmtDay(rates.date)}`}{t.leftOut > 0 ? ` · ${t.leftOut} not converted` : ''}</p>}

      <Sheet page open={!!editing} title="edit cost" onClose={() => setEditing(null)}>
        {editing && <CostForm key={editing.id} trip={trip} cost={editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </div>
  )
}
