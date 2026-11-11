import type { StopKind } from '../lib/types'

export type PillStatus = 'idea' | 'to_book' | 'booked' | 'estimate' | 'paid' | 'settled' | 'warn'

// a stop's status in words. a note needs doing ("buy winter wear"), anything else needs booking:
// they share the same two stored states, so a to-do is [to do] until it's [done]
export function Pill({ status, label, kind }: { status: PillStatus; label?: string; kind?: StopKind }) {
  const todo = kind === 'note'
  switch (status) {
    case 'to_book': return <span className="pill warn">{todo ? 'to do' : 'to book'}</span>
    case 'booked': return <span className="pill ok">{todo ? 'done' : 'booked'}</span>
    case 'paid': return <span className="pill ok">paid</span>
    case 'settled': return <span className="pill ok">settled</span>
    case 'warn': return <span className="pill warn">{label}</span>
    default: return null
  }
}
