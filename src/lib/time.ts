// a time as people type it ("9", "930", "9:30", "13:00", "1pm", "1:30 pm") as hh:mm.
// nothing typed (or "any") is null; something that isn't a time is undefined
export function readTime(typed: string): string | null | undefined {
  const t = typed.trim().toLowerCase()
  if (!t || t === 'any') return null
  const m = t.match(/^(\d{1,2})(?:[:.]?(\d{2}))?\s*([ap])?m?$/)
  if (!m) return undefined
  let h = Number(m[1])
  const min = m[2] ? Number(m[2]) : 0
  const half = m[3]
  if (!half && /m$/.test(t)) return undefined
  if (min > 59) return undefined
  if (half) {
    if (h < 1 || h > 12) return undefined
    h = (h % 12) + (half === 'p' ? 12 : 0)
  } else if (h > 23) return undefined
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

// what's typed so far could still become a time: digits first, then maybe ":" and minutes, then am or pm
const PARTIAL = /^(?:\d{1,4}|\d{1,2}[:.]\d{0,2})?(?:\s?[ap]m?)?$/i
export function couldBeTime(typed: string): boolean {
  return typed === '' || (/^\d/.test(typed) && PARTIAL.test(typed))
}
