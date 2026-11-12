import { useId, useMemo, useState, type FormEvent } from 'react'
import type { Link, Trip } from '../../lib/types'
import { useLinks, useSave, useStops, useTrips } from '../../lib/queries'
import { newId } from '../../lib/id'
import { hostOf } from '../../lib/embed'
import { draftKey, useDraft } from '../../lib/drafts'
import { extractUrl, findSaved, platformOf, type Incoming } from '../../lib/capture'
import { descendants } from '../../lib/countries'
import { useCanEdit } from '../../lib/offline'
import { useToast } from '../../components/Toast'
import { FormFooter, useSubmit } from '../../components/FormFooter'
import { SiteIcon } from '../saved/LinkCard'
import { stopTitle } from '../plan/stopText'

type Draft = { id: string; url: string; title: string; note: string; trip: string; stop: string }

const PLATFORM: Record<string, string> = { instagram: 'instagram', tiktok: 'tiktok', youtube: 'youtube', web: '' }

function tripLabel(t: Trip, trips: Trip[]): string {
  const parent = trips.find((x) => x.id === t.parent_id)
  return (parent ? `${parent.name} · ${t.name}` : t.name).toLowerCase()
}

// one way to keep a link (a reel, a video, a page): pasted, shared in, or opened from the shortcut.
// only the link is needed; title, note, trip and place are all optional, and no date is ever asked for
export function CaptureForm({ initial, tripId, stopId, link, onDone }: { initial: Incoming | null; tripId: string | null; stopId?: string | null; link?: Link; onDone: (saved?: Link) => void }) {
  const save = useSave<Link>('links')
  const links = useLinks().data ?? []
  const trips = useTrips().data ?? []
  const stops = useStops().data ?? []
  const canEdit = useCanEdit()
  const toast = useToast()
  const first = initial ? extractUrl(initial.url) ?? extractUrl(initial.text) ?? '' : ''
  // a shared-in link starts fresh; one typed in a trip is kept as a draft until it's saved
  const [form, update, settle, draft] = useDraft<Draft>(link || initial || stopId ? null : draftKey(tripId, 'link'), () => ({
    id: link?.id ?? newId(), url: link?.url ?? first, title: link?.title ?? initial?.title ?? '', note: link?.note ?? '',
    trip: link ? link.trip_id ?? '' : tripId ?? '', stop: link?.stop_id ?? stopId ?? '',
  }))
  const set = (p: Partial<Draft>) => update((v) => ({ ...v, ...p }))
  const [problem, setProblem] = useState<string | null>(null)
  const { run, saving, failure } = useSubmit()
  const formId = useId()

  const url = extractUrl(form.url)
  // never itself: while it saves, its own new row is already in the list
  const already = useMemo(() => (url && !link ? findSaved(url, links.filter((l) => l.id !== form.id)) : undefined), [url, links, link, form.id])
  const where = already ? (trips.find((t) => t.id === already.trip_id)?.name ?? 'inbox') : null
  const top = trips.filter((t) => !t.parent_id).sort((a, b) => (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999'))
  const ordered = top.flatMap((t) => descendants(t.id, trips).map((id) => trips.find((x) => x.id === id)!).filter(Boolean))
  const places = form.trip ? stops.filter((s) => s.trip_id === form.trip && (s.kind === 'place' || s.kind === 'stay')).sort((a, b) => stopTitle(a).localeCompare(stopTitle(b))) : []

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!url) { setProblem('check the link'); return }
    setProblem(null)
    settle()
    void run(async () => {
      const fields = { trip_id: form.trip || null, stop_id: form.stop || null, note: form.note.trim() }
      let saved: Link
      if (link) {
        // only what changed, so someone else's edit to another field of this link stays
        const next: Record<string, unknown> = { url, title: form.title.trim() || hostOf(url), ...fields }
        const was: Record<string, unknown> = { url: link.url, title: link.title, trip_id: link.trip_id, stop_id: link.stop_id ?? null, note: link.note }
        const changed = Object.fromEntries(Object.entries(next).filter(([k, v]) => v !== was[k]))
        saved = Object.keys(changed).length ? await save.mutateAsync({ id: link.id, ...changed }) : link
      } else if (already) {
        // the same reel twice is one link: it moves to where you put it now, keeping what it had
        saved = await save.mutateAsync({ id: already.id, ...fields, note: fields.note || already.note, ...(form.title.trim() ? { title: form.title.trim() } : {}) })
      } else {
        saved = await save.mutateAsync({ id: form.id, url, title: form.title.trim() || PLATFORM[platformOf(url)] || hostOf(url), ...fields })
      }
      const t = trips.find((x) => x.id === fields.trip_id)
      toast.show({ text: `saved to ${t ? t.name.toLowerCase() : 'inbox'}` })
      onDone(saved)
    })
  }

  return (
    <form id={formId} className="stack page-form capture" onSubmit={submit} noValidate>
      <label className="field">
        <span className="label">link</span>
        <span className="capture-url">
          {url && <SiteIcon url={url} />}
          <input className="title-input link-input" type="url" inputMode="url" aria-label="link" placeholder="paste a link" value={form.url} autoFocus={!form.url}
            onChange={(e) => set({ url: e.target.value })} />
        </span>
      </label>
      {already && <p className="note-line" role="status">already saved in {where}{already.title ? ` · ${already.title}` : ''}</p>}
      <label className="field"><span className="label">title</span><input value={form.title} placeholder={url ? PLATFORM[platformOf(url)] || hostOf(url) : ''} onChange={(e) => set({ title: e.target.value })} /></label>
      <label className="field"><span className="label">note</span><textarea value={form.note} onChange={(e) => set({ note: e.target.value })} /></label>
      <label className="field">
        <span className="label">trip</span>
        <select value={form.trip} onChange={(e) => set({ trip: e.target.value, stop: '' })}>
          <option value="">inbox</option>
          {ordered.map((t) => <option key={t.id} value={t.id}>{tripLabel(t, trips)}</option>)}
        </select>
      </label>
      {places.length > 0 && (
        <label className="field">
          <span className="label">for a place</span>
          <select value={form.stop} onChange={(e) => set({ stop: e.target.value })}>
            <option value="">none</option>
            {places.map((s) => <option key={s.id} value={s.id}>{stopTitle(s).toLowerCase()}</option>)}
          </select>
        </label>
      )}
      <FormFooter form={formId} problem={problem ?? failure ?? (!canEdit ? 'offline · not saved yet' : null)} saving={saving} failed={!!failure}
        onClear={draft.dirty ? () => { draft.clear(); setProblem(null) } : undefined} />
    </form>
  )
}
