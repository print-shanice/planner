import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { Link as Saved } from '../../lib/types'
import { forgetCapture, peekPending, readShareParams, type Incoming } from '../../lib/capture'
import { useTrips } from '../../lib/queries'
import { Icon } from '../../components/Icon'
import { CaptureForm } from './CaptureForm'

// where a shared reel, a shortcut or a pasted link lands: keep it first, sort it out later
export function CapturePage() {
  const [params] = useSearchParams()
  const trips = useTrips().data ?? []
  // the address carries it (shortcut, share target); else what was waiting from before signing in
  const [incoming] = useState<Incoming | null>(() => readShareParams(`?${params}`, '') ?? peekPending())
  const [saved, setSaved] = useState<Saved | null>(null)
  const [again, setAgain] = useState(0)
  const trip = saved ? trips.find((t) => t.id === saved.trip_id) : undefined

  return (
    <main className="capture-page">
      <header className="capture-head">
        <Link to="/" className="back-link"><Icon name="back" /><span>all trips</span></Link>
      </header>
      {saved ? (
        <section className="capture-done" aria-label="saved">
          <p className="mono-label">saved</p>
          <h1 className="head">{saved.title || saved.url}</h1>
          <p className="muted">{trip ? `in ${trip.name}` : 'in your inbox'}</p>
          <div className="text-links">
            {trip && <Link className="text-link" to={`/trip/${trip.id}?tab=ideas`}>open {trip.name} →</Link>}
            <Link className="text-link" to="/">all trips →</Link>
            <button type="button" className="text-link" onClick={() => { setSaved(null); setAgain((n) => n + 1) }}>save another →</button>
          </div>
        </section>
      ) : (
        <section aria-label="save a link">
          <h1 className="head capture-title">save a link</h1>
          <CaptureForm key={again} initial={again ? null : incoming} tripId={null} onDone={(l) => { forgetCapture(); if (l) setSaved(l) }} />
        </section>
      )}
    </main>
  )
}
