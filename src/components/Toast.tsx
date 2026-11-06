import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

export type ToastInput = { text: string; undo?: () => void; done?: () => void }
type Shown = ToastInput & { n: number }
type Api = { show: (t: ToastInput) => void }

const LIFE = 5000
const Ctx = createContext<Api | null>(null)
// with no toast area there's nothing to undo from, so it finishes at once
const NONE: Api = { show: (t) => t.done?.() }
export const useToast = (): Api => useContext(Ctx) ?? NONE

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Shown | null>(null)
  const [held, setHeld] = useState(false)
  const current = useRef<Shown | null>(null)
  const seq = useRef(0)

  const end = useCallback((undo: boolean) => {
    const t = current.current
    if (!t) return
    current.current = null
    setToast(null)
    setHeld(false)
    if (undo) t.undo?.()
    else t.done?.()
  }, [])

  const show = useCallback((t: ToastInput) => {
    const prev = current.current
    current.current = { ...t, n: ++seq.current }
    setToast(current.current)
    prev?.done?.() // a newer toast finishes the older one
  }, [])

  useEffect(() => {
    if (!toast || held) return
    const timer = setTimeout(() => end(false), LIFE)
    return () => clearTimeout(timer)
  }, [toast, held, end])

  // leaving the page finishes what's waiting, so a removal still goes through
  useEffect(() => {
    const flush = () => end(false)
    const hidden = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', hidden)
    }
  }, [end])

  const api = useMemo(() => ({ show }), [show])
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div key={toast.n} className="toast"
            onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)}
            onFocus={() => setHeld(true)} onBlur={() => setHeld(false)}>
            <span>{toast.text}</span>
            {toast.undo && <button type="button" onClick={() => end(true)}>undo</button>}
          </div>
        )}
      </div>
    </Ctx.Provider>
  )
}
