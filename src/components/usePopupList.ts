import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'

type Where = { top: number; left: number; width: number; up: boolean }
// height: how tall the list can get; width: its width for this button (it lines up with the button's left
// edge, or its right edge with align 'right'), so it can turn upwards when there isn't room below
type Fit = { height: number; width: (button: DOMRect) => number; align: 'left' | 'right' }

// the planner's own dropdowns: a list floating above the page beside its button, so no scrolling box cuts it off.
// it opens on the chosen option (else the first); arrows, home and end move through it; escape, tab, a press
// elsewhere or the page moving under it close it (its own list scrolling doesn't)
export function usePopupList(fit: Fit) {
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState<Where | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const items = () => [...(list.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])]
  const close = (refocus = true) => { setOpen(false); if (refocus) button.current?.focus() }

  useLayoutEffect(() => {
    if (!open || !button.current) return
    const r = button.current.getBoundingClientRect()
    const width = fit.width(r)
    const up = r.bottom + fit.height + 8 > window.innerHeight && r.top > fit.height + 8
    setAt({ top: up ? r.top - fit.height - 6 : r.bottom + 6, left: fit.align === 'right' ? Math.max(8, r.right - width) : r.left, width, up })
  }, [open, fit.height]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    const all = items()
    ;(all.find((o) => o.getAttribute('aria-selected') === 'true') ?? all[0])?.focus()
    const away = (e: PointerEvent) => {
      const t = e.target as Node
      if (!list.current?.contains(t) && !button.current?.contains(t)) close(false)
    }
    const gone = (e: Event) => { if (e.target instanceof Node && list.current?.contains(e.target)) return; close(false) }
    document.addEventListener('pointerdown', away)
    window.addEventListener('resize', gone)
    window.addEventListener('scroll', gone, true)
    return () => {
      document.removeEventListener('pointerdown', away)
      window.removeEventListener('resize', gone)
      window.removeEventListener('scroll', gone, true)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // the list's keys; true when the key was one of them
  function keys(e: KeyboardEvent<HTMLUListElement>): boolean {
    const all = items()
    const i = all.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'ArrowDown') all[Math.min(all.length - 1, i + 1)]?.focus()
    else if (e.key === 'ArrowUp') all[Math.max(0, i - 1)]?.focus()
    else if (e.key === 'Home') all[0]?.focus()
    else if (e.key === 'End') all.at(-1)?.focus()
    else if (e.key === 'Escape') close()
    else if (e.key === 'Tab') { close(false); return true }
    else return false
    e.preventDefault()
    return true
  }

  const style = { position: 'fixed' as const, top: at?.top ?? 0, left: at?.left ?? 0, width: at?.width, visibility: at ? 'visible' as const : 'hidden' as const }
  return { open, setOpen, close, button, list, up: !!at?.up, style, keys }
}
