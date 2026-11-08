// a time as people type it ("9", "930", "9:30", "13:00", "1pm", "1:30 pm") as hh:mm.
// nothing typed (or "any") is null; something that isn't a time is undefined
export function readTime(typed: string): string | null | undefined {
  const t = typed.trim().toLowerCase()
  if (!t || t === 'any') return null
  const m = t.match(/^(\d{1,2})(?:[:.]?(\d{2}))?\s*(am|pm)?$/)
  if (!m) return undefined
  let h = Number(m[1])
  const min = m[2] ? Number(m[2]) : 0
  const half = m[3]
  if (min > 59) return undefined
  if (half) {
    if (h < 1 || h > 12) return undefined
    h = (h % 12) + (half === 'pm' ? 12 : 0)
  } else if (h > 23) return undefined
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}
