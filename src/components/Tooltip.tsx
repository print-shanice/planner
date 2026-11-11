import { cloneElement, useEffect, useId, useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { openLayer } from '../lib/layers'
import { Icon } from './Icon'

type Props = { text: string; children: ReactElement<HTMLAttributes<HTMLElement>>; help?: boolean }
const OPEN = 'planner-tooltip-open'

// Enhance the control itself: no extra layout box, tab stop or intercepted action.
export function Tooltip({ text, children, help = false }: Props) {
  const id = useId()
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const [position, setPosition] = useState({ left: 0, top: 0 })
  const tip = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const pointerFocus = useRef(false)
  const focused = useRef(false)
  const overTip = useRef(false)
  const overTrigger = useRef(false)
  const clear = () => clearTimeout(timer.current)
  const close = () => { clear(); overTip.current = false; setAnchor(null) }
  const show = (el: HTMLElement) => {
    clear()
    trigger.current = el
    window.dispatchEvent(new CustomEvent(OPEN, { detail: id }))
    setAnchor(el.getBoundingClientRect())
  }
  const leave = () => {
    clear()
    timer.current = setTimeout(() => {
      if (!focused.current && !overTrigger.current && !overTip.current) close()
    }, 150)
  }

  useEffect(() => {
    const other = (e: Event) => { if ((e as CustomEvent).detail !== id) close() }
    const released = () => { pointerFocus.current = false }
    window.addEventListener(OPEN, other)
    window.addEventListener('pointerup', released)
    window.addEventListener('pointercancel', released)
    return () => {
      clear()
      window.removeEventListener(OPEN, other)
      window.removeEventListener('pointerup', released)
      window.removeEventListener('pointercancel', released)
    }
  }, [id])

  useEffect(() => {
    if (!anchor) return
    const off = openLayer(close)
    const outside = (e: PointerEvent) => {
      if (!trigger.current?.contains(e.target as Node) && !tip.current?.contains(e.target as Node)) close()
    }
    const scroll = (e: Event) => { if (!(e.target instanceof Node) || !tip.current?.contains(e.target)) close() }
    document.addEventListener('pointerdown', outside)
    window.addEventListener('scroll', scroll, true)
    window.addEventListener('resize', close)
    return () => {
      off()
      document.removeEventListener('pointerdown', outside)
      window.removeEventListener('scroll', scroll, true)
      window.removeEventListener('resize', close)
    }
  }, [!!anchor])

  useLayoutEffect(() => {
    if (!anchor || !tip.current) return
    const { width, height } = tip.current.getBoundingClientRect()
    const left = Math.max(8, Math.min(anchor.left + anchor.width / 2 - width / 2, window.innerWidth - width - 8))
    const above = anchor.top - height - 8
    const top = above >= 8 ? above : Math.max(8, Math.min(anchor.bottom + 8, window.innerHeight - height - 8))
    setPosition({ left, top })
  }, [anchor, text])

  const p = children.props
  return <>
    {cloneElement<HTMLAttributes<HTMLElement>>(children, {
      'aria-describedby': [p['aria-describedby'], anchor ? id : null].filter(Boolean).join(' ') || undefined,
      onPointerEnter: e => {
        p.onPointerEnter?.(e)
        if (e.pointerType === 'touch') return
        overTrigger.current = true
        clear()
        const el = e.currentTarget
        timer.current = setTimeout(() => show(el), 350)
      },
      onPointerLeave: e => { p.onPointerLeave?.(e); overTrigger.current = false; leave() },
      onPointerDown: e => { pointerFocus.current = true; if (!help) close(); p.onPointerDown?.(e) },
      onFocus: e => {
        focused.current = true
        if (!pointerFocus.current) show(e.currentTarget)
        pointerFocus.current = false
        p.onFocus?.(e)
      },
      onBlur: e => { focused.current = false; pointerFocus.current = false; leave(); p.onBlur?.(e) },
      onClick: e => { if (help) show(e.currentTarget); else close(); pointerFocus.current = false; p.onClick?.(e) },
      onKeyDown: e => {
        p.onKeyDown?.(e)
        // Editors may prevent Escape's default. Dismiss help as well, while leaving
        // the event handled so the sheet's layer doesn't close underneath it.
        if (e.key === 'Escape' && anchor) { e.preventDefault(); close() }
      },
    })}
    {anchor && createPortal(
      <div ref={tip} id={id} role="tooltip" className="context-tip" style={position}
        onPointerEnter={() => { overTip.current = true; clear() }}
        onPointerLeave={() => { overTip.current = false; leave() }}>{text}</div>,
      document.body,
    )}
  </>
}

// A separate button makes explanations available on touch screens without taking over an action.
export function Help({ label, children }: { label: string; children: string }) {
  return <Tooltip text={children} help><button type="button" className="help-btn" aria-label={label}><Icon name="info" size={16} /></button></Tooltip>
}
