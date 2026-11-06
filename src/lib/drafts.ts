import { useCallback, useEffect, useRef, useState } from 'react'

// a new item's half-typed form, kept on this device per trip and kind until it's saved
const KEY = 'planner-drafts'

type Store = Record<string, unknown>

function readAll(): Store {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Store } catch { return {} }
}

function writeAll(s: Store) {
  try {
    if (Object.keys(s).length) localStorage.setItem(KEY, JSON.stringify(s))
    else localStorage.removeItem(KEY)
  } catch { /* storage blocked: the draft lasts as long as the sheet */ }
}

export const draftKey = (tripId: string | null, kind: string): string => `${tripId ?? 'none'}:${kind}`
export const readDraft = <T,>(key: string): T | undefined => readAll()[key] as T | undefined
export function writeDraft(key: string, value: unknown): void { writeAll({ ...readAll(), [key]: value }) }
export function clearDraft(key: string): void {
  const s = readAll()
  if (!(key in s)) return
  delete s[key]
  writeAll(s)
}
export function forgetDrafts(): void { writeAll({}) }

// form state that's kept as a draft once touched (key null: plain state); settle() drops it for good,
// because after a save attempt the item exists, or its failed copy waits with a retry
export function useDraft<T>(key: string | null, blank: () => T): [T, (fn: (v: T) => T) => void, () => void] {
  const [restored] = useState(() => (key ? readDraft<T>(key) : undefined))
  const [value, setValue] = useState<T>(() => restored ?? blank())
  const keep = useRef(restored !== undefined)
  const settled = useRef(false)
  const set = useCallback((fn: (v: T) => T) => { keep.current = true; setValue(fn) }, [])
  useEffect(() => {
    if (key && keep.current && !settled.current) writeDraft(key, value)
  }, [key, value])
  const settle = useCallback(() => {
    settled.current = true
    if (key) clearDraft(key)
  }, [key])
  return [value, set, settle]
}
