import { useRef, useState, type MouseEvent, type PointerEvent } from 'react'

// a sideways swipe further than this removes a row (with undo)
export const SWIPE = 80

// either way counts (or only to the left); a row that was dragged doesn't also open what's under the finger
export function useSwipeAway(onAway: () => void, enabled = true, only?: 'left') {
  const start = useRef<number | null>(null)
  const moved = useRef(false)
  const [dx, setDx] = useState(0)
  const reset = () => { start.current = null; setDx(0) }
  return {
    style: dx ? { transform: `translateX(${dx}px)` } : undefined,
    onPointerDown: (e: PointerEvent) => { if (enabled) { start.current = e.clientX; moved.current = false } },
    onPointerMove: (e: PointerEvent) => {
      if (start.current == null) return
      // a held line being carried somewhere isn't a swipe
      if (document.body.classList.contains('carrying')) { reset(); return }
      const d = only === 'left' ? Math.min(0, e.clientX - start.current) : e.clientX - start.current
      if (Math.abs(d) > 8) moved.current = true
      setDx(d)
    },
    onPointerUp: (e: PointerEvent) => {
      if (start.current == null) return
      const d = e.clientX - start.current
      const far = only === 'left' ? d < -SWIPE : Math.abs(d) > SWIPE
      reset()
      if (far) onAway()
    },
    onPointerCancel: reset,
    onClickCapture: (e: MouseEvent) => {
      if (!moved.current) return
      moved.current = false
      e.preventDefault()
      e.stopPropagation()
    },
  }
}
