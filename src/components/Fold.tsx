import { useEffect, useState, type ReactNode } from 'react'

type Props = { label: string; open?: boolean; reveal?: number; children: ReactNode }

// optional fields tucked away; opens by itself when it has something in it,
// and again each time `reveal` changes (a problem inside it, even after it was closed by hand)
export function Fold({ label, open = false, reveal = 0, children }: Props) {
  const [isOpen, setOpen] = useState(open)
  useEffect(() => { if (open || reveal) setOpen(true) }, [open, reveal])
  return (
    <details className="fold" open={isOpen} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{label}</summary>
      <div className="stack">{children}</div>
    </details>
  )
}
