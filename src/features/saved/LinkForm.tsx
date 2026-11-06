import { useState, type FormEvent } from 'react'
import { useSave } from '../../lib/queries'
import { newId } from '../../lib/id'
import { hostOf } from '../../lib/embed'
import { Button } from '../../components/Button'
import { saveError } from '../stops/errors'

export function LinkForm({ tripId, onDone }: { tripId: string | null; onDone: () => void }) {
  const save = useSave('links')
  // one id for the new link, so saving again after a failure sends the same row
  const [id] = useState(newId)
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [problem, setProblem] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    let u = url.trim()
    if (u && !/^https?:\/\//i.test(u)) u = `https://${u}`
    try { new URL(u) } catch { setProblem('check the link'); return }
    try {
      await save.mutateAsync({ id, trip_id: tripId, url: u, title: title.trim() || hostOf(u), note: note.trim() })
      onDone()
    } catch (err) {
      setProblem(saveError(err))
    }
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <label className="field"><span className="label">link</span><input type="url" inputMode="url" value={url} autoFocus onChange={(e) => setUrl(e.target.value)} /></label>
      <label className="field"><span className="label">title</span><input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label className="field"><span className="label">note</span><textarea value={note} onChange={(e) => setNote(e.target.value)} /></label>
      {problem && <p className="warn-line" role="alert">{problem}</p>}
      <div className="row form-actions"><span className="spacer" /><Button variant="primary" type="submit">save</Button></div>
    </form>
  )
}
