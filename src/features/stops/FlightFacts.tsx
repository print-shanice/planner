import { useState } from 'react'
import type { Stop } from '../../lib/types'
import { Button } from '../../components/Button'
import { useCanEdit } from '../../lib/offline'
import { canCheck, flightError, flightNumber, statusUrl, statusWord, useFlightCheck } from '../../lib/flight'

const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

// a flight's live line under its times: how it's going, when that was checked, "check again" on the day,
// and always the way to its live status. its terminals and gates sit with the times above
export function FlightFacts({ stop }: { stop: Stop }) {
  const canEdit = useCanEdit()
  const { check, busy } = useFlightCheck(stop.id)
  const [note, setNote] = useState<string | null>(null)
  if (stop.kind !== 'journey' || stop.mode !== 'flight') return null
  const f = stop.flight
  const number = f?.number ?? flightNumber(stop.title)
  if (!number) return null
  const word = f && statusWord(f)
  const live = f && canCheck(f, new Date())

  async function again() {
    setNote(null)
    const e = await check()
    if (e) setNote(flightError(e, number!, stop.day ?? ''))
  }

  return (
    <div className="card-live">
      {word && <span className={`mono${word.warn ? ' warn-line' : ''}`}>{word.text}</span>}
      {live && !f.dep.gate && <span className="mono muted">gate not out yet</span>}
      {live && <span className="mono muted">checked {clock(f.checked_at)}</span>}
      {live && <Button className="text-btn" busy={busy && 'checking'} disabled={!canEdit} onClick={() => void again()}>check again</Button>}
      <a className="card-link" href={statusUrl(number)} target="_blank" rel="noopener noreferrer">flight status</a>
      {note && <p className="warn-line" role="status">{note}</p>}
    </div>
  )
}
