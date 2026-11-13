import { useMemo, useState, type CSSProperties } from 'react'
import type { Cost, Trip } from '../../lib/types'
import { useCosts, useMembers, useRates, useRemove, useSave, useTrips } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { useAuth } from '../../lib/auth'
import { CATEGORIES, convert, formatMoney, totals } from '../../lib/money'
import { currencyList } from '../../lib/rates'
import { balances, isPayback, standings, transfers } from '../../lib/settle'
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
import { useSubmit } from '../../components/FormFooter'
import { colourVar } from '../../lib/colors'
import { Help, Tooltip } from '../../components/Tooltip'

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
  const [repayment, setRepayment] = useState<{ from: string; to: string; eur: number } | null>(null)
  const { run, saving, failure } = useSubmit()

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
  })

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
    const each = standings(paid, people, rates)
    return { people: each, moves: transfers(bal), most: Math.max(...each.map((p) => Math.abs(p.balance)), 0.01) }
  }, [allCosts, top.id, trips, members, rates])

  if (load.state !== 'ready') return <LoadState load={load} />

  const sorted = [...costs].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.title.localeCompare(b.title))
  const show = (v: number) => formatMoney(v, cur, { whole: true })
  // If a display-currency rate is unavailable, name EUR rather than mislabelling the debt.
  const debt = (eur: number) => {
    const converted = convert(eur, 'EUR', cur, rates)
    return formatMoney(converted ?? eur, converted == null ? 'EUR' : cur, { exact: true })
  }
  const left = budget != null && !over ? budget - total : null
  // a eur amount in the currency on show, in whole units
  const whole = (eur: number) => {
    const converted = convert(eur, 'EUR', cur, rates)
    return formatMoney(converted ?? eur, converted == null ? 'EUR' : cur, { whole: true })
  }
  const faceColor = (id: string) => colourVar(members.find((m) => m.user_id === id)?.color)
  const Face = ({ id }: { id: string }) => <span className="avatar" aria-hidden="true" style={{ background: faceColor(id) }}>{(members.find((m) => m.user_id === id)?.name || '?').slice(0, 1)}</span>
  // a breakdown row: its name and amount over a bar, paid in green and planned hatched, against the biggest row
  const byTrip = [trip, ...kids].map((x) => {
    const mine = x.id === trip.id ? costs.filter((c) => c.trip_id === trip.id) : costs.filter((c) => descendants(x.id, trips).includes(c.trip_id))
    const sum = totals(mine, cur, rates)
    return { id: x.id, name: x.name, color: x.color, paid: sum.paid, planned: sum.planned }
  })
  const cats = Object.entries(t.byCategory).map(([k, v]) => ({ k, label: LABEL[k] ?? k, ...v, sum: v.paid + v.planned })).sort((a, b) => b.sum - a.sum)
  const Share = ({ label, paid, planned, most, dot }: { label: string; paid: number; planned: number; most: number; dot?: string }) => (
    <li className="share-row">
      <span className="share-top"><span>{dot && <span className="dot" style={{ background: dot }} />}{label}</span><span className="num">{show(paid + planned)}</span></span>
      <span className="share-track" aria-hidden="true">
        <span className="share-bar" style={{ width: `${Math.round(((paid + planned) / (most || 1)) * 100)}%` }}>
          {paid > 0 && <span className="paid" style={{ flexGrow: paid }} />}
          {planned > 0 && <span className="planned" style={{ flexGrow: planned }} />}
        </span>
      </span>
    </li>
  )

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
          <div className="help-row"><p className="money-total num head" data-testid="money-total">{show(total)}</p><Help label="about the total">paid costs plus planned estimates; repayments are excluded</Help></div>
          <p className="muted num">{budget != null ? [`of ${show(budget)}`, left != null ? `${show(left)} left` : ''].filter(Boolean).join(' · ') : 'in total'}{left != null && <Help label="about the remaining budget">budget remaining after paid and planned costs</Help>}</p>
        </div>
        <div className="help-row"><select aria-label="show in" className="input cur-select" value={cur} onChange={(e) => setCur(e.target.value)}>
          {currencyList(rates).map((c) => <option key={c} value={c}>{c}</option>)}
        </select><Help label="about display currency">show totals in this currency; individual costs keep their original currency</Help></div>
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
          <p className="label help-label">settle up<Help label="about settling up">{`balances cover ${top.name} and all its side trips, regardless of the spending filter above`}</Help></p>
          <p className="settle-scope muted">{top.name} · with side trips</p>
          <ul className="bal-list">
            {settle.people.map((p) => {
              const square = Math.abs(p.balance) < 0.005
              const label = square ? `${name(p.id)} · settled` : `${name(p.id)} · ${p.balance > 0 ? 'owed' : owes(p.id)} ${debt(Math.abs(p.balance))}`
              const width = `${Math.round((Math.abs(p.balance) / settle.most) * 100)}%`
              return (
                <li key={p.id} className="bal-row" aria-label={label}>
                  <Face id={p.id} />
                  <span className="bal-who">
                    <span className="bal-name">{name(p.id)}</span>
                    <span className="muted num">{`paid ${whole(p.paid)} · share ${whole(p.share)}`}</span>
                  </span>
                  {/* left of the middle: owes; right of it: is owed */}
                  <span className="bal-track" aria-hidden="true" style={{ '--c': faceColor(p.id) } as CSSProperties}>
                    <span className="bal-half down">{!square && p.balance < 0 && <span className="bal-bar down" style={{ width }} />}</span>
                    <span className="bal-half up">{!square && p.balance > 0 && <span className="bal-bar up" style={{ width }} />}</span>
                  </span>
                  <span className="bal-amount num">{square ? debt(0) : `${p.balance > 0 ? '+' : '−'}${debt(Math.abs(p.balance))}`}</span>
                </li>
              )
            })}
          </ul>
          {settle.moves.length === 0 ? <p className="settle-line"><Pill status="settled" /></p> : settle.moves.map((x) => {
            const line = `${name(x.from)} ${owes(x.from)} ${name(x.to)} ${debt(x.eur)}`
            return (
              <div key={`${x.from}-${x.to}`} className="settle-move">
                <span className="settle-faces" aria-hidden="true"><Face id={x.from} /><span className="settle-arrow">→</span><Face id={x.to} /></span>
                <p className="settle-line num">{line}</p>
                {canEdit && <Tooltip text="record money you’ve already paid back; this does not send a payment"><button type="button" className="btn ghost small" aria-label={`paid back: ${line}`} onClick={() => setRepayment(x)}>record repayment</button></Tooltip>}
              </div>
            )
          })}
        </section>
      )}

      {costs.length === 0 && <EmptyState title="no costs yet" />}

      {scoped && kids.length > 0 && costs.length > 0 && (
        <section className="block" aria-label="by trip">
          <h3 className="head">by trip</h3>
          <ul className="list breakdown">
            {byTrip.map((x) => <Share key={x.id} label={x.name} paid={x.paid} planned={x.planned} most={Math.max(...byTrip.map((y) => y.paid + y.planned))} dot={colourVar(x.color)} />)}
          </ul>
        </section>
      )}

      {Object.keys(t.byCategory).length > 0 && (
        <section className="block" aria-label="by category">
          <h3 className="head">by category</h3>
          <ul className="list breakdown">
            {cats.map((c) => <Share key={c.k} label={c.label} paid={c.paid} planned={c.planned} most={cats[0].sum} />)}
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
                    <span className="muted">{[c.date ? fmtDay(c.date) : null, LABEL[c.category] ?? c.category, c.status === 'paid' && c.paid_by ? `paid by ${name(c.paid_by)}` : null].filter(Boolean).join(' · ')}</span>
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
      <Sheet open={!!repayment} title="record repayment" onClose={() => { if (!saving) setRepayment(null) }}>
        {repayment && <div className="stack">
          <p>{name(repayment.from)} paid {name(repayment.to)} {debt(repayment.eur)}</p>
          <p className="muted">{top.name} · with side trips</p>
          <p className="muted">record money you’ve already paid back; this does not send a payment</p>
          {failure && <p className="warn-line" role="alert">{failure}</p>}
          <button type="button" className="btn primary" disabled={saving || !canEdit} onClick={() => void run(async () => {
            const current = settle?.moves.find(x => x.from === repayment.from && x.to === repayment.to)
            if (!current || Math.abs(current.eur - repayment.eur) > 0.005) throw new Error('balance changed; close and review it again')
            await payBack(repayment)
            setRepayment(null)
          })}>{saving ? 'saving' : 'confirm repayment'}</button>
        </div>}
      </Sheet>
    </div>
  )
}
