import { useId, useState, type FormEvent } from 'react'
import { useSave } from '../../lib/queries'
import { newId } from '../../lib/id'
import { hostOf } from '../../lib/embed'
import { draftKey, useDraft } from '../../lib/drafts'
import { FormFooter, useSubmit } from '../../components/FormFooter'

type Draft = { id: string; url: string; title: string; note: string }

export function LinkForm({ tripId, onDone }: { tripId: string | null; onDone: () => void }) {
  const save = useSave('links')
  // kept as a draft for this trip, with one id, so saving again after a failure sends the same row
  const [form, update, settle] = useDraft<Draft>(draftKey(tripId, 'link'), () => ({ id: newId(), url: '', title: '', note: '' }))
  const { id, url, title, note } = form
  const set = (p: Partial<Draft>) => update((v) => ({ ...v, ...p }))
  const [problem, setProblem] = useState<string | null>(null)
  const { run, saving, failure } = useSubmit()
  const formId = useId()

  function submit(e: FormEvent) {
    e.preventDefault()
    let u = url.trim()
    if (u && !/^https?:\/\//i.test(u)) u = `https://${u}`
    try { new URL(u) } catch { setProblem('check the link'); return }
    setProblem(null)
    settle()
    void run(async () => {
      await save.mutateAsync({ id, trip_id: tripId, url: u, title: title.trim() || hostOf(u), note: note.trim() })
      onDone()
    })
  }

  return (
    <form id={formId} className="stack" onSubmit={submit} noValidate>
      <label className="field"><span className="label">link</span><input type="url" inputMode="url" value={url} autoFocus onChange={(e) => set({ url: e.target.value })} /></label>
      <label className="field"><span className="label">title</span><input value={title} onChange={(e) => set({ title: e.target.value })} /></label>
      <label className="field"><span className="label">note</span><textarea value={note} onChange={(e) => set({ note: e.target.value })} /></label>
      <FormFooter form={formId} problem={problem ?? failure} saving={saving} failed={!!failure} />
    </form>
  )
}
