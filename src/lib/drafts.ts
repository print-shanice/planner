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

// a draft kept by an older version of a form has other fields; restoring it would leave some undefined
function sameShape(a: unknown, b: unknown): boolean {
  const plain = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
  if (!plain(a) || !plain(b)) return true
  const ka = Object.keys(a).sort(), kb = Object.keys(b).sort()
  return ka.join() === kb.join() && ka.every((k) => sameShape(a[k], b[k]))
}

export type DraftControl = {
  // a new item's form holds something (never for a form without a key)
  dirty: boolean
  // back to the blank form, and the kept draft forgotten until it's touched again
  clear: () => void
}

// form state that's kept as a draft once touched (key null: plain state); settle() drops it for good,
// because after a save attempt the item exists, or its failed copy waits with a retry
export function useDraft<T>(key: string | null, blank: () => T): [T, (fn: (v: T) => T) => void, () => void, DraftControl] {
  const [first] = useState(() => {
    const empty = blank()
    const kept = key ? readDraft<T>(key) : undefined
    if (kept !== undefined && !sameShape(kept, empty)) { clearDraft(key!); return { empty, restored: undefined } }
    return { empty, restored: kept }
  })
  const restored = first.restored
  const [value, setValue] = useState<T>(() => restored ?? first.empty)
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
  const clear = useCallback(() => {
    keep.current = false
    if (key) clearDraft(key)
    setValue(first.empty)
  }, [key, first.empty])
  const dirty = !!key && JSON.stringify(value) !== JSON.stringify(first.empty)
  return [value, set, settle, { dirty, clear }]
}
