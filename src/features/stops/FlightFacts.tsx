import { useState } from 'react'
import type { Stop } from '../../lib/types'
import { Icon } from '../../components/Icon'
import { Button } from '../../components/Button'
import { useCanEdit } from '../../lib/offline'
import { canCheck, endBits, flightError, flightNumber, statusUrl, statusWord, useFlightCheck } from '../../lib/flight'

const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

// a flight's terminals, gate, desk and belt; on the day, "check again"; always the way to its live status
export function FlightFacts({ stop }: { stop: Stop }) {
  const canEdit = useCanEdit()
  const { check, busy } = useFlightCheck(stop.id)
  const [note, setNote] = useState<string | null>(null)
  if (stop.kind !== 'journey' || stop.mode !== 'flight') return null
  const f = stop.flight
  const number = f?.number ?? flightNumber(stop.title)
  if (!number) return null
  const word = f && statusWord(f)
  const ends = f ? ([[f.dep, 'dep'], [f.arr, 'arr']] as const).flatMap(([e, side]) => {
    const bits = endBits(e, side)
    return bits.length ? [[e.iata, side, [e.iata.toLowerCase(), ...bits].join(' · ')]] : []
  }) : []
  const live = f && canCheck(f, new Date())

  async function again() {
    setNote(null)
    const e = await check()
    if (e) setNote(flightError(e, number!, stop.day ?? ''))
  }

  return (
    <>
      {word && <p className={word.warn ? 'fact warn-line' : 'fact'}>{word.text}</p>}
      {ends.map(([iata, side, text]) => <p key={side} className="fact"><Icon name="plane" size={18} /><span>{text}</span></p>)}
      {live && !f.dep.gate && <p className="fact muted"><Icon name="plane" size={18} /><span>gate not out yet</span></p>}
      {live && (
        <div className="fact flight-check">
          <span className="muted">checked {clock(f.checked_at)}</span>
          <Button busy={busy && 'checking'} disabled={!canEdit} onClick={() => void again()}>check again</Button>
        </div>
      )}
      {note && <p className="fact warn-line" role="status">{note}</p>}
      <a className="fact fact-link" href={statusUrl(number)} target="_blank" rel="noopener noreferrer"><Icon name="ext" size={18} /><span>flight status →</span></a>
    </>
  )
}
