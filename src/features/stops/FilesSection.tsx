import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { FileRow, Stop } from '../../lib/types'
import { useFiles, useRemove, useSave } from '../../lib/queries'
import { newId } from '../../lib/id'
import { supabase } from '../../lib/supabase'
import { Icon } from '../../components/Icon'

const MAX = 20 * 1024 * 1024

export function filesOf(files: FileRow[] | undefined, stopId: string) {
  return (files ?? []).filter((f) => f.stop_id === stopId)
}

export function FilesSection({ stop, canEdit }: { stop: Stop; canEdit: boolean }) {
  const files = filesOf(useFiles().data, stop.id)
  const save = useSave('files')
  const remove = useRemove('files')
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const paths = files.map((f) => f.path)

  const { data: urls } = useQuery({
    queryKey: ['signed', paths],
    enabled: paths.length > 0,
    staleTime: 50 * 60 * 1000,
    gcTime: 55 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.storage.from('files').createSignedUrls(paths, 3600)
      return Object.fromEntries((data ?? []).filter((x) => x.signedUrl).map((x) => [x.path, x.signedUrl]))
    },
  })

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

  if (!files.length && !canEdit) return null
  return (
    <section className="files" aria-label="files">
      {files.map((f) => (
        <div key={f.id} className="file-row">
          <Icon name="file" size={18} />
          {urls?.[f.path]
            ? <a href={urls[f.path]} target="_blank" rel="noopener noreferrer" className="file-name">{f.name}</a>
            : <span className="file-name">{f.name}</span>}
          {canEdit && <button type="button" className="icon-btn" aria-label={`remove ${f.name}`} onClick={() => drop(f)}><Icon name="trash" size={18} /></button>}
        </div>
      ))}
      {canEdit && (
        <label className={`btn ghost small file-add${busy ? ' busy' : ''}`}>
          <Icon name="upload" size={18} /><span>add file</span>
          <input type="file" accept="image/*,application/pdf" multiple hidden disabled={busy}
            onChange={(e) => { upload(e.target.files); e.target.value = '' }} />
        </label>
      )}
      {problem && <p className="warn-line">{problem}</p>}
    </section>
  )
}
