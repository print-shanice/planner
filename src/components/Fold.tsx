import { useEffect, useId, useState, type ReactNode } from 'react'

type Props = { label: string; open?: boolean; reveal?: number; extra?: ReactNode; children: ReactNode }

// optional fields tucked away; opens by itself when it has something in it,
// and again each time `reveal` changes (a problem inside it, even after it was closed by hand).
// `extra` sits in the header row (paid or not paid beside "cost") and doesn't open or close it
export function Fold({ label, open = false, reveal = 0, extra, children }: Props) {
  const id = useId()
  const [isOpen, setOpen] = useState(open)
  useEffect(() => { if (open || reveal) setOpen(true) }, [open, reveal])
  return (
    <div className="form-fold" data-open={isOpen ? '' : undefined}>
      <div className="fold-head">
        <button type="button" className="fold-toggle" aria-expanded={isOpen} aria-controls={id} onClick={() => setOpen(!isOpen)}>{label}</button>
        {extra && <div className="fold-extra">{extra}</div>}
      </div>
      <div id={id} className="stack fold-body" hidden={!isOpen}>{children}</div>
    </div>
  )
}
