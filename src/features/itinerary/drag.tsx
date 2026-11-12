import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Place, Stop, Trip } from '../../lib/types'
import { dayLabel } from '../../components/MonthCalendar'
import { useSave } from '../../lib/queries'
import { useMove } from './useMove'

// what's being carried: a line of the plan (or an idea), or a new place from the map
export type DragPayload =
  | { kind: 'line'; stop: Stop; label: string }
  | { kind: 'new'; stop: Stop; label: string; resolve?: () => Promise<Place> }
export type DropTarget = { day: string; before: string | null }
type Box = { top: number; bottom: number; left: number; right: number }
export type DropZone = { day: string; rect: Box; rows: { id: string; rect: Box }[] }

// where a pointer would drop: the day under it (inside the plan's column), before the first line whose middle is below it
export function targetAt(zones: DropZone[], x: number, y: number): DropTarget | null {
  const zone = zones.find((z) => y >= z.rect.top && y <= z.rect.bottom && x >= z.rect.left && x <= z.rect.right)
  if (!zone) return null
  const row = zone.rows.find((r) => y < (r.rect.top + r.rect.bottom) / 2)
  return { day: zone.day, before: row?.id ?? null }
}

function zonesNow(): DropZone[] {
  return [...document.querySelectorAll<HTMLElement>('[data-drop-day]')].map((el) => ({
    day: el.dataset.dropDay!,
    rect: el.getBoundingClientRect(),
    rows: [...el.querySelectorAll<HTMLElement>('[data-drop-line]')].map((r) => ({ id: r.dataset.dropLine!, rect: r.getBoundingClientRect() })),
  }))
}

// hold: pick up only after the pointer has stayed still this long (a line held, like a phone's home screen);
// moving before then is a scroll, a text selection or a swipe, and nothing is picked up
type Api = { begin: (p: DragPayload, e: { clientX: number; clientY: number }, opts?: { hold?: number }) => void; target: DropTarget | null; carrying: DragPayload | null }
const Ctx = createContext<Api | null>(null)
export const useDrag = () => useContext(Ctx)

// near the top or bottom edge of the plan, the plan scrolls itself while something is carried
const EDGE = 64
function scrollerOf(): { el: HTMLElement | null; top: number; bottom: number } {
  const el = document.querySelector<HTMLElement>('.trip-wide .trip-main')
  if (el) { const r = el.getBoundingClientRect(); return { el, top: r.top, bottom: r.bottom } }
  return { el: null, top: 0, bottom: window.innerHeight }
}

// one carrying at a time for the whole trip page: lines picked up by their grip, places picked up off the map,
// all put down between two lines of any day of the plan
export function DragProvider({ trip, children }: { trip: Trip; children: ReactNode }) {
  const move = useMove(trip)
  const save = useSave('stops')
  const [carrying, setCarrying] = useState<DragPayload | null>(null)
  const [target, setTarget] = useState<DropTarget | null>(null)
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)
  const moveRef = useRef(move)
  moveRef.current = move
  const stopAll = useRef<() => void>(() => {})
  useEffect(() => () => stopAll.current(), [])

  function put(p: DragPayload, t: DropTarget) {
    if (p.kind === 'line') { moveRef.current(p.stop, t.day, t.before); return }
    moveRef.current(p.stop, t.day, t.before, { fresh: true, said: `added to ${dayLabel(t.day)}` })
    // a google result has its spot fetched once it's been put down
    p.resolve?.().then((place) => save.mutate({ id: p.stop.id, place })).catch(() => { /* stays a name: "find on the map" can still find it */ })
  }

  const api = useMemo<Api>(() => ({
    carrying, target,
    begin(p, e, opts = {}) {
      stopAll.current()
      const x0 = e.clientX, y0 = e.clientY
      let started = false
      let over: DropTarget | null = null
      let y = y0
      let frame = 0
      let timer: ReturnType<typeof setTimeout> | undefined
      const start = (x: number, yy: number) => {
        started = true
        document.body.classList.add('carrying')
        window.getSelection?.()?.removeAllRanges()
        if (typeof navigator !== 'undefined') navigator.vibrate?.(8)
        setCarrying(p)
        setAt({ x, y: yy })
        if (typeof requestAnimationFrame === 'function') frame = requestAnimationFrame(roll)
      }
      const roll = () => {
        const s = scrollerOf()
        const step = y < s.top + EDGE ? -14 : y > s.bottom - EDGE ? 14 : 0
        if (step) { if (s.el) s.el.scrollBy?.(0, step); else window.scrollBy?.(0, step) }
        frame = requestAnimationFrame(roll)
      }
      const onMove = (ev: PointerEvent) => {
        if (!started) {
          const far = Math.hypot(ev.clientX - x0, ev.clientY - y0)
          // held: moving first means something else (scrolling, selecting, swiping)
          if (opts.hold) { if (far > 8) stopAll.current(); return }
          // a click stays a click: carrying starts once the pointer has really moved
          if (far < 5) return
          start(ev.clientX, ev.clientY)
        }
        ev.preventDefault()
        y = ev.clientY
        setAt({ x: ev.clientX, y: ev.clientY })
        over = targetAt(zonesNow(), ev.clientX, ev.clientY)
        setTarget(over)
      }
      const finish = (drop: boolean) => () => {
        stopAll.current()
        if (drop && started && over) put(p, over)
      }
      const onUp = finish(true)
      const onCancel = finish(false)
      const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') onCancel() }
      // once a finger has picked something up, the page doesn't scroll under it (the plan scrolls itself at the edges)
      const noScroll = (ev: TouchEvent) => { if (started) ev.preventDefault() }
      if (opts.hold) timer = setTimeout(() => start(x0, y0), opts.hold)
      stopAll.current = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onCancel)
        window.removeEventListener('keydown', onKey)
        window.removeEventListener('touchmove', noScroll)
        clearTimeout(timer)
        if (frame) cancelAnimationFrame(frame)
        document.body.classList.remove('carrying')
        setCarrying(null); setTarget(null); setAt(null)
        stopAll.current = () => {}
      }
      window.addEventListener('pointermove', onMove, { passive: false })
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onCancel)
      window.addEventListener('keydown', onKey)
      window.addEventListener('touchmove', noScroll, { passive: false })
    },
  }), [carrying, target]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Ctx.Provider value={api}>
      {children}
      {carrying && at && createPortal(
        <div className="drag-ghost" aria-hidden="true" style={{ left: at.x + 14, top: at.y + 10 }}>{carrying.label}</div>,
        document.body,
      )}
    </Ctx.Provider>
  )
}
