import { useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import type { DayEntry } from '../../lib/dates'
import { fmtDay } from '../../lib/dates'
import type { Place, Stop, Trip } from '../../lib/types'
import { hasPoint } from '../../lib/walk'
import { positionsAfterMove } from '../../lib/order'
import { useSave } from '../../lib/queries'
import { CountryFlag } from '../../components/CountryFlag'
import { Link } from 'react-router-dom'
import { StopRow } from './StopRow'
import { WalkLeg } from './WalkLeg'
import { AddPlaceField } from './AddPlaceField'

type Props = {
  trip: Trip
  trips?: Trip[]
  date: string
  entries: DayEntry[]
  colorIndex: number
  dayNumber?: number | null
  clash: Set<string>
  canEdit: boolean
  onOpen?: (s: Stop) => void
  onAddPlace: (p: Place, date: string | null) => void
}

// where you are when this row starts / ends (a journey moves you)
const placeIn = (s: Stop): Place | null => (s.kind === 'journey' ? s.origin : s.place)
const placeOut = (s: Stop): Place | null => (s.kind === 'journey' ? s.destination : s.place)

export function nearFor(entries: DayEntry[], trip: Trip) {
  for (const e of entries) if (e.stop && hasPoint(placeOut(e.stop))) { const p = placeOut(e.stop)!; return { lat: p.lat!, lng: p.lng! } }
  return hasPoint(trip.base) ? { lat: trip.base.lat!, lng: trip.base.lng! } : null
}

export function DayCard({ trip, trips, date, entries, colorIndex, dayNumber, clash, canEdit, onOpen, onAddPlace }: Props) {
  const save = useSave('stops')
  const box = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<{ id: string; dy: number } | null>(null)

  const numbered = entries.filter((e) => e.kind === 'stop' && e.stop).map((e) => e.stop!)

  function grab(e: RPointerEvent<HTMLButtonElement>, s: Stop) {
    if (!box.current) return
    e.preventDefault()
    const from = numbered.findIndex((x) => x.id === s.id)
    const rows = numbered.map((x) => box.current!.querySelector<HTMLElement>(`[data-stop="${x.id}"]`))
    const mids = rows.map((r) => (r ? r.getBoundingClientRect().top + r.offsetHeight / 2 : 0))
    const startY = e.clientY
    let to = from
    setDrag({ id: s.id, dy: 0 })
    const move = (ev: PointerEvent) => {
      const dy = ev.clientY - startY
      const y = mids[from] + dy
      to = mids.filter((m, i) => i !== from && m < y).length
      setDrag({ id: s.id, dy })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      setDrag(null)
      if (to === from) return
      const changes = positionsAfterMove(numbered.map((x) => x.id), from, to, numbered.map((x) => x.position))
      for (const c of changes) save.mutate(c)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const items: JSX.Element[] = []
  let n = 0
  let prev: Stop | null = null
  let flexible = false
  for (const e of entries) {
    // side trips never reach a day card: the plan folds them into their own row
    if (!e.stop) continue
    const s = e.stop
    if (e.kind === 'stop' && !s.time && !flexible) {
      items.push(<h4 className="agenda-anytime" key="anytime">any time</h4>)
      flexible = true
      prev = null
    }
    const owner = trips?.find(t => t.id === s.trip_id)
    if (owner && owner.id !== trip.id) items.push(<Link className="agenda-owner" key={`owner-${s.id}-${e.kind}`} to={`/trip/${owner.id}`}><CountryFlag code={owner.base?.country} />{owner.name} · open trip</Link>)
    const a = prev ? placeOut(prev) : null, b = placeIn(s)
    if (prev && hasPoint(a) && hasPoint(b)) items.push(<WalkLeg key={`w-${prev.id}-${s.id}-${e.kind}`} from={a} to={b} />)
    const isNum = e.kind === 'stop'
    if (isNum) n += 1
    items.push(
      <StopRow key={`${s.id}-${e.kind}`} stop={s} variant={e.kind as 'stop' | 'staying' | 'checkout'} n={isNum ? n : undefined}
        colorIndex={colorIndex} clash={clash.has(s.id)} onOpen={onOpen}
        onGrab={canEdit && isNum && !s.time && numbered.every(x => x.trip_id === trip.id && !x.time) && numbered.length > 1 ? (ev) => grab(ev, s) : undefined}
        dragging={drag?.id === s.id && e.kind === 'stop'} offset={drag?.id === s.id && e.kind === 'stop' ? drag.dy : 0} />,
    )
    prev = s
  }

  return (
    <section className="day" id={`day-${date}`} data-testid={`day-${date}`} ref={box}>
      <header className="day-head">
        <span className="day-bar" style={{ background: 'var(--ink)' }} />
        <h3 className="head">{fmtDay(date, { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '')}</h3>
        {dayNumber != null && <span className="muted num">day {dayNumber}</span>}
      </header>
      <div className="day-body">
        {items}
        {canEdit && <AddPlaceField near={nearFor(entries, trip)} onPick={(p) => onAddPlace(p, date)} />}
      </div>
    </section>
  )
}
