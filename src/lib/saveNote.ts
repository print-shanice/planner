import { useCallback, useEffect, useRef, useState } from 'react'

export type SaveNote = 'idle' | 'saving' | 'saved'

// an edit that says so: "saving…" while it goes, then "saved" for a moment (a failure says nothing here:
// the line or card shows "couldn't save" itself)
export function useSaveNote(): [SaveNote, <T>(save: Promise<T>) => Promise<T>] {
  const [note, setNote] = useState<SaveNote>('idle')
  const quiet = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(quiet.current), [])
  const track = useCallback(<T,>(save: Promise<T>): Promise<T> => {
    clearTimeout(quiet.current)
    setNote('saving')
    return save.then(
      (v) => { setNote('saved'); quiet.current = setTimeout(() => setNote('idle'), 1800); return v },
      (e) => { setNote('idle'); throw e },
    )
  }, [])
  return [note, track]
}
