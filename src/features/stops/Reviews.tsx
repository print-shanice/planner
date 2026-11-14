import { useEffect, useState } from 'react'
import type { Review, Stop } from '../../lib/types'
import { useAuth } from '../../lib/auth'
import { useCanEdit } from '../../lib/offline'
import { useMembers, useReviews, useSave, useStops, useTrips } from '../../lib/queries'
import { samePlace } from '../../lib/agenda'
import { countdown, fmtDay, todayISO } from '../../lib/dates'
import { loadState } from '../../lib/load'
import { LoadState } from '../../components/States'
import { saveError } from '../../lib/errors'
import { newId } from '../../lib/id'
import { useSaveNote } from '../../lib/saveNote'
import { Pending } from '../../components/Pending'
import { Icon } from '../../components/Icon'

type Draft = { rating: number | null; return_choice: Review['return_choice'] | null; outcome: Review['outcome']; comments: string }
const draftOf = (r?: Review): Draft => ({ rating: r?.rating ?? null, return_choice: r?.return_choice ?? null, outcome: r?.outcome ?? 'planned', comments: r?.comments ?? '' })

const OUTCOMES: Review['outcome'][] = ['planned', 'done', 'skipped']
const RETURNS = ['yes', 'maybe', 'no'] as const

// your visit, as rows like the rest of the card: a word tapped is picked (tapped again, unpicked), and comments
// save when you leave them. nothing to press to save
function ReviewForm({ stop, author, review }: { stop: Stop; author: string; review?: Review }) {
  const save = useSave('reviews')
  const [newReviewId] = useState(newId)
  const id = review?.id ?? newReviewId
  const [touched, setTouched] = useState(false)
  const [d, setD] = useState(() => draftOf(review))
  const [failed, setFailed] = useState<string | null>(null)
  const [state, track] = useSaveNote()
  // a review that arrives after opening shows, until you change something
  useEffect(() => { if (!touched && review) setD(draftOf(review)) }, [review, touched])
  async function put(x: Draft) {
    setD(x); setTouched(true); setFailed(null)
    try {
      await track(save.mutateAsync({ id, stop_id: stop.id, author_id: author, ...x }))
    } catch (error) { setFailed(saveError(error)) }
  }
  const pick = <K extends keyof Draft>(k: K, v: Draft[K]) => put({ ...d, [k]: d[k] === v && k !== 'outcome' ? null : v })
  return <>
    <h3 className="mono-label review-head">your visit</h3>
    <dl className="card-rows review-rows">
      <dt className="mono-label">visit</dt>
      <dd><span className="card-options" role="group" aria-label="visit">
        {OUTCOMES.map((o) => <button key={o} type="button" aria-pressed={d.outcome === o} onClick={() => pick('outcome', o)}>{o}</button>)}
      </span></dd>
      <dt className="mono-label">rating</dt>
      <dd><span className="card-options" role="group" aria-label="rating">
        {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" className="num" aria-pressed={d.rating === n} aria-label={`${n} of 5`} onClick={() => pick('rating', n)}>{n}</button>)}
      </span></dd>
      <dt className="mono-label">return</dt>
      <dd><span className="card-options" role="group" aria-label="would return">
        {RETURNS.map((r) => <button key={r} type="button" aria-pressed={d.return_choice === r} onClick={() => pick('return_choice', r)}>{r}</button>)}
      </span></dd>
      <dt className="mono-label">comments</dt>
      <dd><textarea data-quiet="" className="card-field" aria-label="comments" placeholder="—" rows={2} value={d.comments}
        onChange={(e) => { setTouched(true); setD({ ...d, comments: e.target.value }) }}
        onBlur={() => { if (d.comments !== (review?.comments ?? '')) put(d) }} /></dd>
    </dl>
    {failed
      ? <p className="warn-line" role="alert">{failed} <button type="button" className="card-link" onClick={() => put(d)}>retry</button></p>
      : state === 'saving' ? <Pending label="saving" />
      : state === 'saved' ? <span className="mono muted card-saved" role="status"><Icon name="check" size={15} />saved</span>
      : null}
  </>
}

export function Reviews({ stop }: { stop: Stop }) {
  const query = useReviews()
  const stops = useStops().data ?? []
  const members = useMembers().data ?? []
  const { userId } = useAuth()
  const editable = useCanEdit()
  const trip = useTrips().data?.find(t => t.id === stop.trip_id)
  const load = loadState(query)
  // reviews only open once the stop's trip is over
  if (!trip || countdown(trip, todayISO()).kind !== 'done') return null
  const mine = query.data?.find(r => r.stop_id === stop.id && r.author_id === userId)
  const history = (query.data ?? []).filter(r => {
    const visit = stops.find(s => s.id === r.stop_id)
    return (r.stop_id === stop.id || (visit && samePlace(stop.place, visit.place))) && r.id !== mine?.id
  }).sort((a, b) => (stops.find(s => s.id === b.stop_id)?.day ?? '').localeCompare(stops.find(s => s.id === a.stop_id)?.day ?? ''))
  const line = (r: Review) => [r.outcome, r.rating ? `${r.rating}/5` : null, r.return_choice === 'yes' ? 'would return' : r.return_choice === 'no' ? 'wouldn’t return' : r.return_choice === 'maybe' ? 'might return' : null].filter(Boolean).join(' · ')
  return <section className="reviews" aria-label="reviews">
    <LoadState load={load} />
    {load.state === 'ready' && <>
      {editable && userId ? <ReviewForm key={`${stop.id}-${userId}`} stop={stop} author={userId} review={mine} />
        : mine && <>
          <h3 className="mono-label review-head">your visit</h3>
          <article className="visit-review"><p>{line(mine)}</p>{mine.comments && <p className="muted">{mine.comments}</p>}</article>
        </>}
      {history.length > 0 && <h3 className="mono-label review-head">earlier</h3>}
      {history.map(r => {
        const date = stops.find(s => s.id === r.stop_id)?.day
        return <article key={r.id} className="visit-review">
          <p>{members.find(m => m.user_id === r.author_id)?.name ?? 'traveller'} · {date ? fmtDay(date, { day: 'numeric', month: 'short', year: 'numeric' }) : 'no date'}</p>
          <p className="muted">{line(r)}</p>
          {r.comments && <p className="muted">{r.comments}</p>}
        </article>
      })}
    </>}
  </section>
}
