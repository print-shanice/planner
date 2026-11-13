import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import type { FileRow, Stop } from '../../lib/types'
import { useFiles, useRemove, useSave } from '../../lib/queries'
import { newId } from '../../lib/id'
import { supabase } from '../../lib/supabase'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Sheet'
import { Pending } from '../../components/Pending'
import { keepTickets, openTicket } from '../../lib/ticketCache'

const MAX = 20 * 1024 * 1024

export function filesOf(files: FileRow[] | undefined, stopId: string) {
  return (files ?? []).filter((f) => f.stop_id === stopId)
}

// the card's "attach a ticket" opens the picker through pickerRef: there's no add button here
export function FilesSection({ stop, canEdit, pickerRef }: { stop: Stop; canEdit: boolean; pickerRef: Ref<{ open: () => void }> }) {
  const input = useRef<HTMLInputElement>(null)
  useImperativeHandle(pickerRef, () => ({ open: () => input.current?.click() }), [])
  const files = filesOf(useFiles().data, stop.id)
  const save = useSave('files')
  const remove = useRemove('files')
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [viewing, setViewing] = useState<{ file: FileRow; url: string } | null>(null)
  const [opening, setOpening] = useState<string | null>(null)
  const key = files.map((f) => f.id).join()

  // keep a device copy of every ticket on a stop that has been opened, for use without signal
  useEffect(() => { if (files.length) keepTickets(files) }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (viewing) URL.revokeObjectURL(viewing.url) }, [viewing])

  async function view(f: FileRow) {
    setProblem(null)
    setOpening(f.id)
    try { setViewing({ file: f, url: await openTicket(f) }) } catch (e) {
      setProblem((e as Error).message === 'not saved offline' ? 'not saved offline' : "couldn't open, try again")
    } finally { setOpening(null) }
  }

  async function upload(list: FileList | null) {
    if (!list?.length) return
    setProblem(null)
    setBusy(true)
    try {
      for (const file of Array.from(list)) {
        if (file.size > MAX) { setProblem('files must be under 20 mb'); continue }
        const safe = file.name.replace(/[^\w.-]+/g, '-').slice(-80)
        const path = `${stop.trip_id}/${stop.id}/${newId()}-${safe}`
        const { error } = await supabase.storage.from('files').upload(path, file, { contentType: file.type || undefined })
        if (error) throw error
        await save.mutateAsync({ stop_id: stop.id, path, name: file.name, mime: file.type })
      }
    } catch {
      setProblem("couldn't upload, try again")
    } finally {
      setBusy(false)
    }
  }

  async function drop(f: FileRow) {
    await supabase.storage.from('files').remove([f.path])
    await remove.mutateAsync(f.id)
  }

  const picker = canEdit && <input ref={input} type="file" accept="image/*,application/pdf" multiple hidden disabled={busy} aria-label="add file"
    onChange={(e) => { upload(e.target.files); e.target.value = '' }} />
  if (!files.length && !busy && !problem) return picker || null
  return (
    <section className="files" aria-label="files">
      {files.map((f) => (
        <div key={f.id} className="file-row">
          <Icon name="file" size={18} />
          <button type="button" className="file-name" aria-busy={opening === f.id || undefined} onClick={() => view(f)}>{f.name}</button>
          {opening === f.id && <span className="muted pulse">opening…</span>}
          {canEdit && <button type="button" className="icon-btn" aria-label={`remove ${f.name}`} onClick={() => drop(f)}><Icon name="trash" size={18} /></button>}
        </div>
      ))}
      {picker}
      {busy && <Pending label="uploading…" />}
      {problem && <p className="warn-line">{problem}</p>}
      <Sheet open={!!viewing} title={viewing?.file.name ?? ''} onClose={() => setViewing(null)}>
        {viewing && (
          <div className="ticket">
            {viewing.file.mime.startsWith('image/')
              ? <img src={viewing.url} alt={viewing.file.name} />
              : <iframe src={viewing.url} title={viewing.file.name} />}
            <a className="btn ghost block" href={viewing.url} download={viewing.file.name} target="_blank" rel="noopener noreferrer"><Icon name="ext" size={18} /><span>open</span></a>
          </div>
        )}
      </Sheet>
    </section>
  )
}
