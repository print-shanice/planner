import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Trip } from '../../lib/types'
import { ancestors } from '../../lib/countries'
import { byStart, fmtRange } from '../../lib/dates'
import { Icon } from '../../components/Icon'
import { TripMark } from '../../components/TripMark'
import { tint } from '../../components/MonthCalendar'

// the whole family of a trip, from the top: open along the way to the current trip, folded elsewhere
export function TripTree({ trips, current, onPick, flagsOf }: { trips: Trip[]; current: string; onPick: () => void; flagsOf?: (t: Trip) => string[] }) {
  const path = ancestors(current, trips)
  const root = path[0] ?? trips.find((t) => t.id === current)!
  const [open, setOpen] = useState(() => new Set([...path.map((t) => t.id), current]))
  const kids = (id: string) => trips.filter((t) => t.parent_id === id).sort(byStart)

  // a plain function, not a component, so expanding a row keeps focus on its toggle
  function node(t: Trip, depth: number): JSX.Element {
    const children = kids(t.id)
    const expanded = open.has(t.id)
    return (
      <li key={t.id}>
        <div className="tree-row" style={{ paddingLeft: Math.min(depth, 3) * 16 }}>
          <Link to={`/trip/${t.id}`} className="tree-link" aria-current={t.id === current ? 'page' : undefined} onClick={onPick}>
            <span className="tree-mark" style={tint(t.color)}><TripMark codes={flagsOf?.(t) ?? []} max={depth === 0 ? 1 : 3} /></span>
            <span className="tree-name">{t.name}</span>
            <span className="muted num">{t.start_date ? fmtRange(t.start_date, t.end_date) : 'no dates'}</span>
          </Link>
          {children.length > 0 && depth > 0 && (
            <button type="button" className="icon-btn tree-toggle" aria-label={`side trips of ${t.name}`} aria-expanded={expanded}
              onClick={() => setOpen((s) => { const n = new Set(s); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n })}>
              <Icon name="chevron" />
            </button>
          )}
        </div>
        {children.length > 0 && (expanded || depth === 0) && (
          <ul className="tree">{children.map((c) => node(c, depth + 1))}</ul>
        )}
      </li>
    )
  }

  return <ul className="tree tree-root">{node(root, 0)}</ul>
}
