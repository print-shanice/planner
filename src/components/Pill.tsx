export type PillStatus = 'idea' | 'to_book' | 'booked' | 'estimate' | 'paid' | 'settled' | 'warn'

export function Pill({ status, label }: { status: PillStatus; label?: string }) {
  switch (status) {
    case 'to_book': return <span className="pill warn">to book</span>
    case 'booked': return <span className="pill ok">booked</span>
    case 'paid': return <span className="pill ok">paid</span>
    case 'settled': return <span className="pill ok">settled</span>
    case 'warn': return <span className="pill warn">{label}</span>
    default: return null
  }
}
