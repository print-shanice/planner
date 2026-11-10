import { useState, type MouseEvent } from 'react'
import { Icon } from './Icon'

// copies the text beside it; where the clipboard is blocked it selects the text instead
export function Copy({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  async function copy(e: MouseEvent<HTMLButtonElement>) {
    const box = e.currentTarget.parentElement
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const el = box?.querySelector('.copy-text')
      if (el) { const r = document.createRange(); r.selectNodeContents(el); const sel = getSelection(); sel?.removeAllRanges(); sel?.addRange(r) }
    }
    setDone(true)
    setTimeout(() => setDone(false), 1500)
  }
  return <button type="button" className="icon-btn" aria-label={label} onClick={copy}><Icon name={done ? 'check' : 'copy'} size={18} /></button>
}
