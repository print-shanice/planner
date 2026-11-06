import { clear, createStore, get, set } from 'idb-keyval'
import type { FileRow } from './types'
import { supabase } from './supabase'

// tickets are kept on the device so they open without signal
const store = createStore('planner-tickets', 'tickets')

type Saved = { type: string; buf: ArrayBuffer }

// stored as bytes, not a Blob: older iOS Safari can't keep Blobs in IndexedDB
function bytes(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer()
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as ArrayBuffer)
    r.onerror = () => reject(r.error)
    r.readAsArrayBuffer(blob)
  })
}

export async function getTicket(fileId: string): Promise<Blob | null> {
  const v = await get<Saved>(fileId, store)
  return v ? new Blob([v.buf], { type: v.type }) : null
}

export async function putTicket(fileId: string, blob: Blob): Promise<void> {
  await set(fileId, { type: blob.type, buf: await bytes(blob) } satisfies Saved, store)
}

async function download(file: FileRow): Promise<Blob | null> {
  try {
    const { data, error } = await supabase.storage.from('files').download(file.path)
    if (error || !data) return null
    await putTicket(file.id, data)
    return data
  } catch {
    return null
  }
}

export async function openTicket(file: FileRow): Promise<string> {
  const online = typeof navigator === 'undefined' || navigator.onLine
  const blob = (online ? await download(file) : null) ?? (await getTicket(file.id))
  if (!blob) throw new Error('not saved offline')
  return URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: file.mime || undefined }))
}

// keep a copy of every ticket on a stop that has been looked at
export async function keepTickets(files: FileRow[]): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return
  for (const f of files) if (!(await getTicket(f.id))) await download(f)
}

export async function clearTickets(): Promise<void> {
  await clear(store)
}
