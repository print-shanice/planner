import { useEffect, useState, type FormEvent } from 'react'
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

function ReviewForm({ stop, author, review }: { stop: Stop; author: string; review?: Review }) {
  const save = useSave('reviews')
  const [newReviewId] = useState(newId)
  const id = review?.id ?? newReviewId
  const [dirty, setDirty] = useState(false)
  const [rating, setRating] = useState(review?.rating?.toString() ?? '')
  const [returnChoice, setReturn] = useState(review?.return_choice ?? '')
  const [outcome, setOutcome] = useState(review?.outcome ?? 'planned')
  const [comments, setComments] = useState(review?.comments ?? '')
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!dirty && review) {
      setRating(review.rating?.toString() ?? ''); setReturn(review.return_choice ?? '')
      setOutcome(review.outcome); setComments(review.comments)
    }
  }, [review, dirty])
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (save.isPending) return
    setMessage(''); setFailed(false)
    try {
      await save.mutateAsync({ id, stop_id: stop.id, author_id: author, rating: rating ? Number(rating) : null,
        return_choice: returnChoice || null, outcome, comments })
      setMessage('review saved')
    } catch (error) { setFailed(true); setMessage(saveError(error)) }
  }
  return <form className="stack review-form" onSubmit={submit} onChange={() => { setDirty(true); setMessage('') }}>
    <h3 className="head">your visit</h3>
    <label className="field"><span className="label">visit</span><select aria-label="visit" value={outcome} onChange={e => setOutcome(e.target.value as Review['outcome'])}>
      <option value="planned">planned</option><option value="done">done</option><option value="skipped">skipped</option>
    </select></label>
    <div className="row">
      <label className="field"><span className="label">rating</span><select aria-label="rating" value={rating} onChange={e => setRating(e.target.value)}>
        <option value="">not rated</option>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} / 5</option>)}
      </select></label>
      <label className="field"><span className="label">would return</span><select aria-label="would return" value={returnChoice} onChange={e => setReturn(e.target.value as typeof returnChoice)}>
        <option value="">undecided</option><option value="yes">yes</option><option value="maybe">maybe</option><option value="no">no</option>
      </select></label>
    </div>
    <label className="field"><span className="label">comments</span><textarea value={comments} onChange={e => setComments(e.target.value)} /></label>
    {message && <p role={failed ? 'alert' : 'status'}>{message}</p>}
    <button type="submit" className="btn primary" disabled={save.isPending}>{save.isPending ? 'saving' : failed ? 'retry' : 'save review'}</button>
  </form>
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
  return <section className="stack reviews" aria-label="reviews">
    <h2 className="head">reviews</h2>
    <LoadState load={load} />
    {load.state === 'ready' && <>
      {history.map(r => {
        const date = stops.find(s => s.id === r.stop_id)?.day
        return <article key={r.id} className="visit-review">
          <strong>{members.find(m => m.user_id === r.author_id)?.name ?? 'traveller'} · {date ? fmtDay(date, { day: 'numeric', month: 'short', year: 'numeric' }) : 'no date'}</strong>
          <p>{[r.outcome, r.rating ? `${r.rating} / 5` : null, r.return_choice ? `would return: ${r.return_choice}` : null].filter(Boolean).join(' · ')}</p>
          {r.comments && <p className="notes">{r.comments}</p>}
        </article>
      })}
      {editable && userId ? <ReviewForm key={`${stop.id}-${userId}`} stop={stop} author={userId} review={mine} />
        : mine && <article className="visit-review"><strong>your visit · {mine.outcome}</strong><p>{mine.rating ? `${mine.rating} / 5` : 'not rated'} · would return: {mine.return_choice ?? 'undecided'}</p><p className="notes">{mine.comments}</p></article>}
    </>}
  </section>
}
