import { useState, type ReactNode } from 'react'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Sheet'

export function ItemMenu({ title, children }: { title: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="icon-btn" aria-label="more" onClick={() => setOpen(true)}><Icon name="more" size={20} /></button>
      <Sheet open={open} title={title} onClose={() => setOpen(false)}>
        <div className="stack">{children(() => setOpen(false))}</div>
      </Sheet>
    </>
  )
}
