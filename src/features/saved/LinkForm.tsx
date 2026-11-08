import { useId, useState, type FormEvent } from 'react'
import type { Link } from '../../lib/types'
import { useSave } from '../../lib/queries'
import { newId } from '../../lib/id'
import { hostOf } from '../../lib/embed'
import { draftKey, useDraft } from '../../lib/drafts'
import { FormFooter, useSubmit } from '../../components/FormFooter'

type Draft = { id: string; url: string; title: string; note: string }

export function LinkForm({ tripId, link, onDone }: { tripId: string | null; link?: Link; onDone: () => void }) {
  const save = useSave('links')
  // kept as a draft for this trip, with one id, so saving again after a failure sends the same row
  const [form, update, settle] = useDraft<Draft>(link ? null : draftKey(tripId, 'link'), () => ({ id: link?.id ?? newId(), url: link?.url ?? '', title: link?.title ?? '', note: link?.note ?? '' }))
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
      await save.mutateAsync(link
        ? { id, ...(u !== link.url ? { url: u } : {}), ...(title.trim() !== link.title ? { title: title.trim() || hostOf(u) } : {}), ...(note.trim() !== link.note ? { note: note.trim() } : {}) }
        : { id, trip_id: tripId, url: u, title: title.trim() || hostOf(u), note: note.trim() })
      onDone()
    })
  }

  return (
    <form id={formId} className="stack page-form" onSubmit={submit} noValidate>
      <p className="form-q">paste a link</p>
      <input className="title-input link-input" type="url" inputMode="url" aria-label="link" placeholder="https://" value={url} autoFocus onChange={(e) => set({ url: e.target.value })} />
      <p className="form-q">title</p>
      <input className="title-input small" aria-label="title" placeholder="title" value={title} onChange={(e) => set({ title: e.target.value })} />
      <p className="form-q">note</p>
      <textarea className="note-text" aria-label="note" placeholder="why you saved it" value={note} onChange={(e) => set({ note: e.target.value })} />
      <FormFooter form={formId} problem={problem ?? failure} saving={saving} failed={!!failure} />
    </form>
  )
}
