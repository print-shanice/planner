import { useSyncExternalStore } from 'react'
import type { TableName } from './types'

// changes the server hasn't taken: saves that failed (kept on screen with a retry, and on this device
// across reloads) and rows waiting out their undo before they're deleted
export type Failed = { id: string; fields: Record<string, unknown>; isNew: boolean }
export type Pending = { failed: Record<string, Failed>; hidden: string[] }

const KEY = 'planner-unsaved'
const EMPTY: Pending = { failed: {}, hidden: [] }
type State = Partial<Record<TableName, Pending>>

let state: State = read()
const subs = new Set<() => void>()

function read(): State {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, Record<string, Failed>>
    return Object.fromEntries(Object.entries(saved).map(([t, failed]) => [t, { failed, hidden: [] }]))
  } catch {
    return {}
  }
}

function write() {
  const failed = Object.entries(state).filter(([, p]) => p && Object.keys(p.failed).length).map(([t, p]) => [t, p!.failed])
  try {
    if (failed.length) localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(failed)))
    else localStorage.removeItem(KEY)
  } catch { /* storage blocked: still kept for this visit */ }
}

function update(table: TableName, fn: (p: Pending) => Pending) {
  const next = fn(state[table] ?? EMPTY)
  state = { ...state, [table]: Object.keys(next.failed).length || next.hidden.length ? next : undefined }
  write()
  for (const f of subs) f()
}

export function failSave(table: TableName, id: string, fields: Record<string, unknown>, isNew: boolean): void {
  update(table, (p) => {
    const prev = p.failed[id]
    return { ...p, failed: { ...p.failed, [id]: { id, fields: { ...prev?.fields, ...fields }, isNew: isNew || !!prev?.isNew } } }
  })
}

// a save that reached the server clears the fields it carried
export function savedFields(table: TableName, id: string, fields: string[]): void {
  const prev = state[table]?.failed[id]
  if (!prev) return
  update(table, (p) => {
    const rest = Object.fromEntries(Object.entries(prev.fields).filter(([k]) => !fields.includes(k)))
    const failed = { ...p.failed }
    if (Object.keys(rest).length) failed[id] = { ...prev, fields: rest }
    else delete failed[id]
    return { ...p, failed }
  })
}

export const failureOf = (table: TableName, id: string): Failed | undefined => state[table]?.failed[id]

export function hide(table: TableName, id: string): void {
  update(table, (p) => (p.hidden.includes(id) ? p : { ...p, hidden: [...p.hidden, id] }))
}

export function unhide(table: TableName, id: string): void {
  update(table, (p) => ({ ...p, hidden: p.hidden.filter((x) => x !== id) }))
}

export function forgetPending(): void {
  state = {}
  write()
  for (const f of subs) f()
}

function subscribe(cb: () => void) {
  subs.add(cb)
  return () => { subs.delete(cb) }
}

export function usePending(table: TableName): Pending {
  return useSyncExternalStore(subscribe, () => state[table] ?? EMPTY)
}

export function useFailure(table: TableName, id: string): Failed | undefined {
  return useSyncExternalStore(subscribe, () => state[table]?.failed[id])
}

// what the screen shows: the server's rows, with unsaved changes kept and rows waiting on undo left out
export function overlay<T>(rows: T[], p: Pending): T[] {
  if (p === EMPTY) return rows
  const idOf = (r: T) => (r as { id?: string }).id ?? ''
  const hidden = new Set(p.hidden)
  const out = rows.filter((r) => !hidden.has(idOf(r))).map((r) => (p.failed[idOf(r)] ? { ...r, ...p.failed[idOf(r)].fields } : r))
  const have = new Set(rows.map(idOf))
  for (const f of Object.values(p.failed)) if (f.isNew && !have.has(f.id) && !hidden.has(f.id)) out.push({ ...f.fields, id: f.id } as T)
  return out
}
