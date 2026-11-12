import { useState } from 'react'
import type { Stop } from '../../lib/types'
import { Button } from '../../components/Button'
import { useCanEdit } from '../../lib/offline'
import { canCheck, flightError, flightNumber, useFlightCheck } from '../../lib/flight'

const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

// around the flight (a day before to an hour after landing): when it was last checked and "check again",
// in the flight's own row. how it's going sits in the card's label, its terminals and gates with the times
export function FlightCheck({ stop }: { stop: Stop }) {
  const canEdit = useCanEdit()
  const { check, busy } = useFlightCheck(stop.id)
  const [note, setNote] = useState<string | null>(null)
  const f = stop.kind === 'journey' && stop.mode === 'flight' ? stop.flight : null
  const number = f?.number ?? flightNumber(stop.title)
  if (!f || !number || !canCheck(f, new Date())) return null

  async function again() {
    setNote(null)
    const e = await check()
    if (e) setNote(flightError(e, number!, stop.day ?? ''))
  }

  return (
    <>
      <span className="mono muted card-checked">checked {clock(f.checked_at)}</span>
      <Button className="text-btn" busy={busy && 'checking'} disabled={!canEdit} onClick={() => void again()}>check again</Button>
      {note && <p className="warn-line card-note" role="status">{note}</p>}
    </>
  )
}
