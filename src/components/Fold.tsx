import { useEffect, useState, type ReactNode } from 'react'

// optional fields tucked away; opens by itself when it has something in it
export function Fold({ label, open = false, children }: { label: string; open?: boolean; children: ReactNode }) {
  const [isOpen, setOpen] = useState(open)
  useEffect(() => { if (open) setOpen(true) }, [open])
  return (
    <details className="fold" open={isOpen} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{label}</summary>
      <div className="stack">{children}</div>
    </details>
  )
}
