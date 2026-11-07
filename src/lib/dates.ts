import type { Stop, Trip } from './types'

const DAY = 86_400_000
const toMs = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10), 12)
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export function addDays(d: string, n: number): string {
  return fromMs(toMs(d) + n * DAY)
}

export function daysBetween(a: string, b: string): number {
  return Math.round((toMs(b) - toMs(a)) / DAY)
}

export function range(a: string, b: string): string[] {
  const out: string[] = []
  for (let d = a; d <= b && out.length < 2000; d = addDays(d, 1)) out.push(d)
  return out
}

export function tripDays(t: Trip): string[] {
  if (!t.start_date || !t.end_date || t.end_date < t.start_date) return []
  return range(t.start_date, t.end_date)
}

export function nights(a: string | null, b: string | null): number | null {
  if (!a || !b) return null
  return Math.max(0, daysBetween(a, b))
}

export function stayDays(s: Stop): string[] {
  if (!s.day) return []
  if (!s.end_date || s.end_date <= s.day) return [s.day]
  return range(s.day, s.end_date)
}

export type DayEntry = { kind: 'stop' | 'staying' | 'checkout' | 'sidetrip'; stop?: Stop; trip?: Trip }

function stopDays(s: Stop): string[] {
  return s.kind === 'stay' ? stayDays(s) : s.day ? [s.day] : []
}

export function visibleDays(t: Trip, stops: Stop[], children: Trip[]): string[] {
  const all = tripDays(t)
  if (all.length && all.length <= 21) return all
  // a long trip lists only days with something starting or ending on them
  const set = new Set<string>()
  for (const s of stops) {
    const ds = stopDays(s)
    if (ds.length) { set.add(ds[0]); set.add(ds[ds.length - 1]) }
  }
  for (const c of children) if (c.start_date) set.add(c.start_date)
  const inTrip = (d: string) => !all.length || (d >= all[0] && d <= all[all.length - 1])
  return [...set].filter(inTrip).sort()
}

const byOrder = (a: Stop, b: Stop) =>
  a.position - b.position || (a.time ?? '99').localeCompare(b.time ?? '99')

export function groupByDay(t: Trip, stops: Stop[], children: Trip[]) {
  const days = new Map<string, DayEntry[]>()
  const push = (d: string, e: DayEntry) => {
    if (!days.has(d)) days.set(d, [])
    days.get(d)!.push(e)
  }
  for (const d of visibleDays(t, stops, children)) days.set(d, [])
  const undated: Stop[] = []
  const rank = { sidetrip: 0, checkout: 1, staying: 2, stop: 3 }

  for (const c of children) if (c.start_date) push(c.start_date, { kind: 'sidetrip', trip: c })
  for (const s of [...stops].sort(byOrder)) {
    if (!s.day) { undated.push(s); continue }
    if (s.kind === 'stay') {
      const ds = stayDays(s)
      ds.forEach((d, i) => {
        const kind = i === 0 ? 'stop' : i === ds.length - 1 ? 'checkout' : 'staying'
        // "staying at" only joins days that are already shown
        if (kind !== 'staying' || days.has(d)) push(d, { kind, stop: s })
      })
    } else push(s.day, { kind: 'stop', stop: s })
  }
  const out = [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, entries]) => ({
    date,
    entries: entries.sort((a, b) => {
      const ra = a.kind === 'stop' ? 3 : rank[a.kind]
      const rb = b.kind === 'stop' ? 3 : rank[b.kind]
      if (ra !== rb) return ra - rb
      if (a.stop && b.stop && a.kind === 'stop' && b.kind === 'stop') return byOrder(a.stop, b.stop)
      return 0
    }),
  }))
  return { days: out, undated }
}

export function countdown(t: Trip, today: string): { kind: 'upcoming' | 'ongoing' | 'done' | 'undated'; days: number } {
  if (!t.start_date) return { kind: 'undated', days: 0 }
  if (today < t.start_date) return { kind: 'upcoming', days: daysBetween(today, t.start_date) }
  const end = t.end_date ?? t.start_date
  if (today <= end) return { kind: 'ongoing', days: daysBetween(t.start_date, today) + 1 }
  return { kind: 'done', days: 0 }
}

export function dayColor(index: number): string {
  void index
  return 'var(--g0)'
}

export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function fmtDay(d: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }): string {
  return new Date(toMs(d)).toLocaleDateString('en-GB', { timeZone: 'UTC', ...opts }).toLowerCase()
}

export function fmtRange(a: string | null, b: string | null): string {
  if (!a) return ''
  if (!b || a === b) return fmtDay(a)
  const sameMonth = a.slice(0, 7) === b.slice(0, 7)
  return sameMonth ? `${+a.slice(8)} – ${fmtDay(b)}` : `${fmtDay(a)} – ${fmtDay(b)}`
}
