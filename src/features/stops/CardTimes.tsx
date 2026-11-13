import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Stop } from '../../lib/types'
import { readTime } from '../../lib/time'
import { dayLabel, nights } from '../../lib/dates'
import { canCheck, endBits } from '../../lib/flight'
import { journeyLength } from '../../lib/span'

type Put = (changes: Partial<Stop>) => void

// a time written straight on the card: it saves when you leave it or press enter; anything that isn't a time goes back
export function TimeField({ label, value, onSave, disabled }: { label: string; value: string | null; onSave: (t: string | null) => void; disabled?: boolean }) {
  const [v, setV] = useState(value ?? '')
  const ref = useRef<HTMLInputElement>(null)
  const typed = useRef(v)
  typed.current = v
  const skip = useRef(false)
  // someone else's change shows, unless you're typing in it
  useEffect(() => { if (document.activeElement !== ref.current) setV(value ?? '') }, [value])
  function done() {
    if (skip.current) { skip.current = false; return }
    const t = readTime(typed.current)
    if (t === undefined) { setV(value ?? ''); return }
    setV(t ?? '')
    if ((t ?? null) !== (value ?? null)) onSave(t ?? null)
  }
  return (
    <input ref={ref} type="text" data-quiet="" className="card-time" aria-label={label} placeholder="any" value={v} disabled={disabled}
      inputMode="decimal" autoComplete="off" onChange={(e) => setV(e.target.value)} onBlur={done}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
        if (e.key === 'Escape') { e.preventDefault(); skip.current = true; setV(value ?? ''); e.currentTarget.blur() }
      }} />
  )
}

// one side of the top block: a small label, the big time, then what's under it
function End({ label, children, end }: { label: string; children: ReactNode; end?: boolean }) {
  return (
    <div className={`card-end${end ? ' far' : ''}`}>
      <span className="mono-label">{label}</span>
      {children}
    </div>
  )
}

function Between({ text }: { text: string | null }) {
  return <div className="card-between" aria-hidden={!text}>{text && <span className="mono">{text}</span>}<span className="card-rule" /></div>
}

// the top of a card: when it starts and ends, big, so it reads at a glance
export function CardTimes({ stop: s, canEdit, put }: { stop: Stop; canEdit: boolean; put: Put }) {
  const off = !canEdit
  if (s.kind === 'journey') {
    const f = s.mode === 'flight' ? s.flight : null
    const lands = s.mode === 'flight' ? 'lands' : 'arrives'
    const code = (iata?: string) => (iata ? ` · ${iata.toLowerCase()}` : '')
    // a flight's ends by their cities (the code is in the label); anything else by the station or stop's name
    const flight = s.mode === 'flight'
    const from = (f?.dep.city || (flight && s.origin?.city) || s.origin?.name || '').toLowerCase()
    const to = (f?.arr.city || (flight && s.destination?.city) || s.destination?.name || '').toLowerCase()
    // on the day, a gate that isn't out yet says so where the gate goes
    const depBits = f ? [...endBits(f.dep), ...(!f.dep.gate && canCheck(f, new Date()) ? ['gate not out yet'] : [])] : []
    const arrBits = f ? endBits(f.arr) : []
    return (
      <div className="card-times" role="group" aria-label="times">
        <End label={`departs${code(f?.dep.iata)}`}>
          <TimeField label="departs" value={s.time} disabled={off} onSave={(time) => put({ time })} />
          {from && <span className="card-place">{from}</span>}
          {depBits.length > 0 && <span className="card-bits mono">{depBits.map((b) => <span key={b}>{b}</span>)}</span>}
        </End>
        <Between text={journeyLength(s)} />
        <End label={`${lands}${code(f?.arr.iata)}`} end>
          <TimeField label={lands} value={s.end_time} disabled={off} onSave={(end_time) => put({ end_time })} />
          {s.end_date && s.end_date !== s.day && <span className="card-day">{dayLabel(s.end_date)}</span>}
          {to && <span className="card-place">{to}</span>}
          {arrBits.length > 0 && <span className="card-bits mono">{arrBits.map((b) => <span key={b}>{b}</span>)}</span>}
        </End>
      </div>
    )
  }
  if (s.kind === 'stay') {
    const n = nights(s.day, s.end_date)
    return (
      <div className="card-times" role="group" aria-label="times">
        <End label="check in">
          <TimeField label="check in" value={s.time} disabled={off} onSave={(time) => put({ time })} />
          {s.day && <span className="card-day">{dayLabel(s.day)}</span>}
        </End>
        <Between text={n ? `${n} ${n === 1 ? 'night' : 'nights'}` : null} />
        <End label="check out" end>
          <TimeField label="check out" value={s.end_time} disabled={off} onSave={(end_time) => put({ end_time })} />
          {s.end_date && <span className="card-day">{dayLabel(s.end_date)}</span>}
        </End>
      </div>
    )
  }
  return (
    <div className="card-times pair" role="group" aria-label="times">
      <End label="from"><TimeField label="from" value={s.time} disabled={off} onSave={(time) => put({ time })} /></End>
      <End label="until"><TimeField label="until" value={s.end_time} disabled={off} onSave={(end_time) => put({ end_time })} /></End>
    </div>
  )
}
