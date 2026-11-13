import { useEffect, useState } from 'react'

// a press that asks to be pressed again: it stays armed for three seconds, then lets go
export function useArmed(): [boolean, (on: boolean) => void] {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])
  return [armed, setArmed]
}

export function TwoTapDelete({ onConfirm, label = 'delete', disabled = false }: { onConfirm: () => void; label?: string; disabled?: boolean }) {
  const [armed, setArmed] = useArmed()
  return (
    <button type="button" disabled={disabled} className={`btn ghost danger${armed ? ' armed' : ''}`}
      onClick={() => { if (armed) { setArmed(false); onConfirm() } else setArmed(true) }}>
      {armed ? 'tap again to delete' : label}
    </button>
  )
}
