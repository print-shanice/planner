import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { DayOff, Stop, Trip } from '../../lib/types'
import type { Holiday } from '../../lib/holidays'
import { addDays, byStart, dayLabel, fmtDay, fmtRange } from '../../lib/dates'
import { tint } from '../../components/MonthCalendar'
import { TripMark } from '../../components/TripMark'
import { CountryFlag } from '../../components/CountryFlag'
import { Pill } from '../../components/Pill'
import { Sheet } from '../../components/Sheet'
import { offBetween } from '../../lib/daysOff'
import { DayOffForm } from './DayOffForm'

// beside the month on home: what's on in it and what's still to do in it (two tabs: bookings to make and to-dos), then its holidays:
// your own (hatched, like their days) and the public ones (an amber rule, like theirs), in one list by date.
// both tabs share one space sized to the taller, so switching never moves the holidays below
type Props = {
  month: string
  trips: Trip[]
  stops: Stop[]
  flagsOf: (t: Trip) => string[]
  holidays: (from: string, to: string) => (Holiday & { trip: Trip })[]
  daysOff?: DayOff[]
}

const lastDay = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  return addDays(m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`, -1)
}
// the hidden tab can't be tabbed into or read out (react 18 doesn't know `inert` yet, so it goes on as a plain attribute)
const away = (hidden: boolean) => (hidden ? ({ inert: '' } as object) : {})

export function MonthSide({ month, trips, stops, flagsOf, holidays, daysOff = [] }: Props) {
  const [tab, setTab] = useState<'on' | 'todo'>('on')
  const from = `${month}-01`
  const to = lastDay(month)
  const name = fmtDay(from, { month: 'long' })
  const on = trips.filter((t) => t.start_date && (t.end_date ?? t.start_date) >= from && t.start_date <= to).sort(byStart)
  const parentOf = (t: Trip) => trips.find((p) => p.id === t.parent_id)
  const todo = stops.filter((s) => s.status === 'to_book' && s.day && s.day >= from && s.day <= to)
    .sort((a, b) => a.day!.localeCompare(b.day!) || (a.time ?? '99').localeCompare(b.time ?? '99'))
  const later = stops.filter((s) => s.status === 'to_book' && s.day && s.day > to).length
  const tripOf = (s: Stop) => trips.find((t) => t.id === s.trip_id)
  const [editing, setEditing] = useState<DayOff | null>(null)
  type Row = { key: string; date: string; off?: DayOff; pub?: Holiday & { trip: Trip } }
  const hols: Row[] = [
    ...offBetween(daysOff, from, to).map((o) => ({ key: o.id, date: o.start_date, off: o })),
    ...holidays(from, to).map((h) => ({ key: `${h.date}-${h.country}-${h.name}`, date: h.date, pub: h })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  return (
    <aside className="month-side" aria-label={`${name} at a glance`}>
      <div className="month-tabs" role="tablist" aria-label={`${name} at a glance`}>
        <button type="button" role="tab" id="tab-on" aria-controls="pane-on" aria-selected={tab === 'on'} onClick={() => setTab('on')}>
          on in {name} · {on.length}
        </button>
        <button type="button" role="tab" id="tab-todo" aria-controls="pane-todo" aria-selected={tab === 'todo'} onClick={() => setTab('todo')}>
          to do · {todo.length}
        </button>
      </div>
      <div className="month-panes">
        <div role="tabpanel" id="pane-on" aria-labelledby="tab-on" className="month-pane" data-shown={tab === 'on' || undefined} {...away(tab !== 'on')}>
          {on.length === 0 && <p className="pane-empty">no trips in {name}</p>}
          {on.map((t) => {
            const all = t.start_date! <= from && (t.end_date ?? t.start_date!) >= to
            const parent = parentOf(t)
            return (
              <Link key={t.id} to={`/trip/${t.id}`} className="side-row" style={tint(t.color)}>
                <span className="swatch-sq" aria-hidden="true" />
                <span className="side-row-title">
                  <span className="side-row-name">{t.name}</span>
                  <TripMark codes={flagsOf(t)} max={1} />
                </span>
                <span className="side-row-when num">{all ? `all ${name}` : fmtRange(t.start_date, t.end_date)}</span>
                {parent && <span className="side-row-of">side trip of {parent.name}</span>}
              </Link>
            )
          })}
        </div>
        <div role="tabpanel" id="pane-todo" aria-labelledby="tab-todo" className="month-pane" data-shown={tab === 'todo' || undefined} {...away(tab !== 'todo')}>
          {todo.length === 0 && <p className="pane-empty">nothing to do in {name}</p>}
          {todo.map((s) => (
            <Link key={s.id} to={`/trip/${s.trip_id}?day=${s.day}&open=${s.id}`} className="side-row" style={tint(tripOf(s)?.color)}>
              <span className="swatch-sq" aria-hidden="true" />
              <span className="side-row-name sans">{s.title || s.place?.name || 'untitled'}</span>
              <span className="side-row-when num">{fmtDay(s.day!, { day: 'numeric', month: 'short' })}</span>
              <Pill status="to_book" kind={s.kind} />
              {tripOf(s) && <span className="side-row-of">{tripOf(s)!.name}</span>}
            </Link>
          ))}
          {later > 0 && <p className="pane-later">+ {later} more to do after {name}</p>}
        </div>
      </div>
      {hols.length > 0 && (
        <section className="month-hols" aria-label={`holidays in ${name}`}>
          <h3 className="month-hols-h">holidays in {name}</h3>
          {hols.map(({ key, off, pub }) => (off ? (
            <div key={key} className="hol-row" data-testid="hol-row">
              <span className="off-mark" aria-hidden="true" />
              <span className="num">{off.start_date === off.end_date ? dayLabel(off.start_date) : fmtRange(off.start_date, off.end_date)}</span>
              <span className="hol-name">{off.name}</span>
              <button type="button" className="row-edit" aria-label={`edit ${off.name.toLowerCase()}`} onClick={() => setEditing(off)}>edit</button>
            </div>
          ) : (
            <div key={key} className="hol-row" data-testid="hol-row">
              <span className="hol-rule" aria-hidden="true" />
              <span className="num">{dayLabel(pub!.date)}</span>
              <span className="hol-name">{pub!.name} <CountryFlag code={pub!.country} /></span>
              <span className="hol-trip">{pub!.trip.name}</span>
            </div>
          )))}
        </section>
      )}
      <Sheet page open={!!editing} title="holiday" onClose={() => setEditing(null)}>
        {editing && <DayOffForm key={editing.id} off={editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </aside>
  )
}
