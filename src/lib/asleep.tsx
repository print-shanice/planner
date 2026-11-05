import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

// a free supabase project pauses after a week unused; while online, no answer (or a 5xx) means asleep
const asleep = (e: unknown) => {
  const status = (e as { status?: number } | null)?.status
  return (typeof navigator === 'undefined' || navigator.onLine) && (status === 0 || (typeof status === 'number' && status >= 500))
}

export function AsleepBanner() {
  const qc = useQueryClient()
  const [on, setOn] = useState(false)
  useEffect(() => qc.getQueryCache().subscribe((ev) => {
    if (ev.type !== 'updated') return
    if (ev.action.type === 'error') { if (asleep(ev.action.error)) setOn(true) }
    else if (ev.action.type === 'success') setOn(false)
  }), [qc])
  if (!on) return null
  return (
    <div className="asleep-banner" role="status">
      <span className="warn-line">the planner is asleep</span>
      <a className="btn ghost small" href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">open supabase</a>
    </div>
  )
}
