import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useWide } from '../../lib/useWide'
import { useReadingDay } from '../trip/readingDay'
import type { Stop } from '../../lib/types'
import type { DayEntry } from '../../lib/dates'
import { useSave } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { kindChange } from '../../lib/lineKind'
import { hasPoint } from '../../lib/walk'
import { Icon } from '../../components/Icon'
import { useStartFind } from '../trip/find'
import { useLocating } from '../../lib/locating'
import { Chip, Seq } from './ItinLine'

const KIND_WORDS = { place: 'a place', journey: 'getting around', note: 'a note' } as const
type Kind = keyof typeof KIND_WORDS

// the slot before a line's name says what the line is: its number when it's on the map, a pin+ when it's a place
// not found yet, or the icon of getting around or a note, which opens a menu to say it's something else
export function Marker({ stop: s, kind, seq }: { stop: Stop; kind: DayEntry['kind']; seq?: number }) {
  const canEdit = useCanEdit()
  const [, setParams] = useSearchParams()
  const wide = useWide()
  const reading = useReadingDay()
  const find = useStartFind()
  const save = useSave('stops')
  const [open, setOpen] = useState(false)
  const looking = useLocating(s.id)
  const box = useRef<HTMLSpanElement>(null)
  const title = (s.title || s.place?.name || 'this line').toLowerCase()

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', away)
    box.current?.querySelector<HTMLElement>('.marker-opt')?.focus()
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  if (seq) return (
    <button type="button" className="marker-btn numbered" aria-label={`show ${title} on the map`} title="show on the map" onClick={() => {
      if (s.day) reading.set(s.day)
      setParams((p) => {
        const n = new URLSearchParams(p)
        n.set('pin', s.id)
        n.delete('find'); n.delete('map')
        if (s.day) n.set('day', s.day)
        if (!wide) n.set('tab', 'map')
        return n
      })
    }}><Seq n={seq} /></button>
  )
  const line = kind === 'stop'
  const typedJourney = s.kind === 'journey' && !s.origin && !s.destination
  if (!canEdit || !line || s.kind === 'stay' || (s.kind === 'journey' && !typedJourney)) return <Chip stop={s} quiet={!line} />
  if (s.kind === 'place' && !hasPoint(s.place)) {
    // being looked up in the background right now
    if (looking) return <span className="marker-finding" role="status" aria-label="finding the place"><span className="pending-dot pulse" aria-hidden="true" /></span>
    return (
      <button type="button" className="marker-btn find" aria-label={`find ${title} on the map`} title="find on the map" onClick={() => find(s)}>
        <Icon name="pin" size={16} /><span className="marker-plus" aria-hidden="true">+</span>
      </button>
    )
  }
  if (s.kind !== 'journey' && s.kind !== 'note') return <Chip stop={s} />

  function become(k: Kind) {
    setOpen(false)
    if (k === s.kind) return
    save.mutate(kindChange(s, k))
    if (k === 'place') find(s)
  }

  return (
    <span className="marker" ref={box} onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setOpen(false) } }}>
      <button type="button" className="marker-btn" aria-label={`what ${title} is: ${KIND_WORDS[s.kind]}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Chip stop={s} />
      </button>
      {open && (
        <span className="marker-menu" role="group" aria-label="what this line is">
          {(['place', 'journey', 'note'] as Kind[]).map((k) => (
            <button key={k} type="button" className={`marker-opt${s.kind === k ? ' on' : ''}`} aria-pressed={s.kind === k} onClick={() => become(k)}>
              <Icon name={k === 'place' ? 'pin' : k === 'journey' ? 'train' : 'note'} size={16} />
              <span>{KIND_WORDS[k]}</span>
              <span className="muted">{k === 'place' ? 'on the map' : 'no pin'}</span>
            </button>
          ))}
        </span>
      )}
    </span>
  )
}
