import { useEffect, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { clampSplit, readSplit, saveSplit, SPLIT_DEFAULT, SPLIT_MIN, MAP_MIN } from '../../lib/split'

const STEP = 24

// the plan's width beside the map: null until someone has moved the line
export function useSplit(): [number | null, (px: number | null) => void] {
  const [w, setW] = useState<number | null>(() => { const s = readSplit(); return s == null ? null : clampSplit(s, window.innerWidth) })
  // a smaller window never leaves the map without room
  useEffect(() => {
    const fit = () => setW((x) => (x == null ? x : clampSplit(x, window.innerWidth)))
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])
  const set = (px: number | null) => {
    const next = px == null ? null : clampSplit(px, window.innerWidth)
    setW(next)
    saveSplit(next)
  }
  return [w, set]
}

// the line between plan and map: drag it, or focus it and use the arrow keys; a double click puts it back
export function SplitHandle({ width, onChange }: { width: number | null; onChange: (px: number | null) => void }) {
  const [dragging, setDragging] = useState(false)
  const now = width ?? Math.min(SPLIT_DEFAULT, clampSplit(SPLIT_DEFAULT, window.innerWidth))

  function down(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    e.preventDefault()
    setDragging(true)
    const move = (ev: globalThis.PointerEvent) => onChange(ev.clientX)
    const up = () => {
      setDragging(false)
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up)
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up)
  }
  function key(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); onChange(now - STEP) }
    if (e.key === 'ArrowRight') { e.preventDefault(); onChange(now + STEP) }
    if (e.key === 'Home') { e.preventDefault(); onChange(SPLIT_MIN) }
    if (e.key === 'End') { e.preventDefault(); onChange(window.innerWidth - MAP_MIN) }
  }
  return (
    <div className={`split-handle${dragging ? ' dragging' : ''}`} role="separator" aria-orientation="vertical" aria-label="resize plan and map" tabIndex={0}
      aria-valuenow={now} aria-valuemin={SPLIT_MIN} aria-valuemax={Math.max(SPLIT_MIN, window.innerWidth - MAP_MIN)}
      onPointerDown={down} onKeyDown={key} onDoubleClick={() => onChange(null)} />
  )
}
