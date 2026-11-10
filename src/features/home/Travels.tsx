import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Review, Stop, Trip } from '../../lib/types'
import { fmtDay } from '../../lib/dates'
import { aroundTheWorld, favourites, stamps, tickets, type LngLat, type Route } from '../../lib/travels'
import { tint } from '../../components/MonthCalendar'
import { stopTitle } from '../plan/StopRow'
import { Stamp } from './Stamp'

export type GlobeAsk = { routes: [LngLat, LngLat][]; focus: { code: string; n: number } | null; ready: boolean }

type Props = { trips: Trip[]; stops: Stop[]; reviews: Review[]; today: string; globe: (ask: GlobeAsk) => ReactNode }

const KINDS = [['flights', 'flights'], ['trains', 'trains'], ['ground', 'buses · ferries']] as const

// travels: the globe on top (beside, on a laptop), a scrapbook of where you've been underneath.
// a ticket draws its routes on the globe; a stamp turns the globe to its country
export function Travels({ trips, stops, reviews, today, globe }: Props) {
  const t = useMemo(() => tickets(trips, stops, today), [trips, stops, today])
  const s = useMemo(() => stamps(trips, stops, today), [trips, stops, today])
  const f = useMemo(() => favourites(trips, stops, reviews), [trips, stops, reviews])
  const [open, setOpen] = useState<(typeof KINDS)[number][0] | null>(null)
  const [focus, setFocus] = useState<GlobeAsk['focus']>(null)
  const routes = open ? t[open].map((r) => r.line).filter((l): l is [LngLat, LngLat] => !!l) : []
  const kinds = KINDS.filter(([k]) => t[k].length > 0)
  // the globe starts drawing once the view has slid in, so the slide never stutters (its space is kept meanwhile)
  const [settled, setSettled] = useState(false)
  useEffect(() => { const id = setTimeout(() => setSettled(true), 380); return () => clearTimeout(id) }, [])

  function turnTo(code: string) {
    setFocus((was) => ({ code, n: (was?.n ?? 0) + 1 }))
    // on a phone the globe is up above: bring it into view
    document.querySelector('.travels-card')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="travels">
      <div className="travels-globe">{globe({ routes, focus, ready: settled })}</div>
      <div className="scrapbook">
        {kinds.length > 0 && (
          <section className="scrap" aria-labelledby="scrap-around">
            <div className="scrap-head">
              <h2 id="scrap-around" className="head">getting around</h2>
              {t.km > 0 && <span className="mono-label">{Math.round(t.km).toLocaleString('en-GB')} km</span>}
            </div>
            {t.km > 0 && (
              <div className="world-line">
                <span className="world-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, (t.km / 40075) * 100)}%` }} /></span>
                <span className="muted">{aroundTheWorld(t.km)}</span>
              </div>
            )}
            <div className="stubs">
              {kinds.map(([k, label], i) => (
                <Ticket key={k} label={label} routes={t[k]} open={open === k} style={{ '--i': i } as CSSProperties}
                  onToggle={() => setOpen((o) => (o === k ? null : k))} />
              ))}
            </div>
          </section>
        )}

        {s.length > 0 && (
          <section className="scrap" aria-labelledby="scrap-passport">
            <div className="scrap-head">
              <h2 id="scrap-passport" className="head">passport</h2>
              <span className="mono-label">{s.length} {s.length === 1 ? 'stamp' : 'stamps'}</span>
            </div>
            <div className="passport">
              {s.map((st, i) => {
                const date = fmtDay(st.first, { day: 'numeric', month: 'short', year: 'numeric' })
                return (
                  <button key={st.code} type="button" className="stamp" style={{ ...tint(st.color), '--i': i } as CSSProperties}
                    aria-label={`${st.name} · first stamped ${date}`} onClick={() => turnTo(st.code)}>
                    <Stamp code={st.code} name={st.name} date={date} />
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {f.length > 0 && (
          <section className="scrap" aria-labelledby="scrap-favourites">
            <div className="scrap-head">
              <h2 id="scrap-favourites" className="head">favourites</h2>
              <span className="mono-label">★ {f.length}</span>
            </div>
            <div className="polaroids">
              {f.map((fav, i) => {
                const q = new URLSearchParams()
                if (fav.stop.day) q.set('day', fav.stop.day)
                q.set('open', fav.stop.id)
                const p = fav.stop.place ?? fav.stop.destination
                return (
                  <Link key={fav.stop.id} to={`/trip/${fav.stop.trip_id}?${q}`} className="polaroid" style={{ ...tint(fav.color), '--i': i } as CSSProperties}>
                    <span className="polaroid-photo" aria-hidden="true">{fav.code?.toLowerCase() ?? ''}</span>
                    <span className="polaroid-name">{stopTitle(fav.stop)}</span>
                    {p?.city && <span className="muted polaroid-city">{p.city.toLowerCase()}</span>}
                    <span className="polaroid-stars" role="img" aria-label={`${fav.rating} stars`}>{'★'.repeat(fav.rating)}</span>
                    {fav.back && <span className="mono-label">would go back</span>}
                  </Link>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function Ticket({ label, routes, open, onToggle, style }: { label: string; routes: Route[]; open: boolean; onToggle: () => void; style: CSSProperties }) {
  return (
    <div className={`stub${open ? ' open' : ''}`} style={style}>
      <button type="button" className="stub-face" aria-expanded={open} aria-label={`${label} · ${routes.length}`} onClick={onToggle}>
        <span className="stub-text"><span className="mono-label">ticket</span><span className="stub-name">{label}</span></span>
        <span className="stub-n num">{routes.length}</span>
      </button>
      {open && (
        <ul className="stub-routes" aria-label={label}>
          {routes.map((r) => (
            <li key={r.id}>
              <span>{r.from || '?'} → {r.to || '?'}</span>
              <span className="muted num">{fmtDay(r.day)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
