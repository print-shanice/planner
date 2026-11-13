import type { Link } from './types'
import { hostOf } from './embed'

// a link arriving from a share sheet, a shortcut or a paste
export type Incoming = { url: string; title: string; text: string }

const URL_RE = /\bhttps?:\/\/[^\s<>"']+|\bwww\.[^\s<>"']+/i

export function extractUrl(text: string | null | undefined): string | null {
  const t = (text ?? '').trim()
  // a bare domain typed by hand ("example.com/page") is a link too
  const m = t.match(URL_RE) ?? (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(t) ? [t] : null)
  if (!m) return null
  let u = m[0].replace(/[).,!?;:]+$/, '')
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`
  try { new URL(u); return u } catch { return null }
}

export type Platform = 'instagram' | 'tiktok' | 'youtube' | 'web'

function host(url: string): string {
  try { return new URL(url).hostname.toLowerCase().replace(/^(www|m|vm|vt)\./, '') } catch { return '' }
}

export function platformOf(url: string): Platform {
  const h = host(url)
  if (h === 'instagram.com' || h === 'instagr.am') return 'instagram'
  if (h === 'tiktok.com') return 'tiktok'
  if (h === 'youtube.com' || h === 'youtu.be' || h === 'music.youtube.com') return 'youtube'
  return 'web'
}

const TRACKING = /^(utm_\w+|igsh|igshid|si|fbclid|gclid|mc_\w+|ref|ref_src|is_from_webapp|sender_device|feature|t|s|_r)$/i

// one key per thing saved: the same reel shared twice (with different tracking bits) is one link
const PLATFORM_NAME: Record<Platform, string> = { instagram: 'instagram', tiktok: 'tiktok', youtube: 'youtube', web: '' }

// what a new link is called until someone names it: the app it's from, else its site
export const linkTitle = (url: string): string => PLATFORM_NAME[platformOf(url)] || hostOf(url)

export function linkKey(raw: string): string {
  let u: URL
  try { u = new URL(raw.trim()) } catch { return raw.trim().toLowerCase() }
  const h = host(raw)
  const parts = u.pathname.split('/').filter(Boolean)
  if (platformOf(raw) === 'instagram') {
    const at = parts.findIndex((p) => ['reel', 'reels', 'p', 'tv'].includes(p))
    if (at >= 0 && parts[at + 1]) return `instagram:${parts[at + 1]}`
  }
  if (platformOf(raw) === 'youtube') {
    const id = h === 'youtu.be' ? parts[0] : u.searchParams.get('v') ?? (['shorts', 'embed', 'live'].includes(parts[0]) ? parts[1] : null)
    if (id) return `youtube:${id}`
  }
  if (platformOf(raw) === 'tiktok') {
    const at = parts.indexOf('video')
    if (at >= 0 && parts[at + 1]) return `tiktok:${parts[at + 1]}`
  }
  const keep = [...u.searchParams.entries()].filter(([k]) => !TRACKING.test(k)).sort(([a], [b]) => a.localeCompare(b))
  const q = keep.length ? `?${new URLSearchParams(keep)}` : ''
  return `${h}${u.pathname.replace(/\/+$/, '').toLowerCase()}${q}`
}

export function findSaved(url: string, links: Link[]): Link | undefined {
  const k = linkKey(url)
  return links.find((l) => linkKey(l.url) === k)
}

// a share target lands on /planner/?url=…; a shortcut opens /planner/#/save?url=…
export function readShareParams(search: string, hash: string): Incoming | null {
  const fromHash = hash.startsWith('#/save') ? hash.slice(hash.indexOf('?') >= 0 ? hash.indexOf('?') : hash.length) : ''
  const p = new URLSearchParams(fromHash || search)
  const rawUrl = p.get('url') ?? p.get('u') ?? ''
  const text = p.get('text') ?? ''
  const title = p.get('title') ?? ''
  if (!rawUrl && !text && !hash.startsWith('#/save')) return null
  const url = extractUrl(rawUrl) ?? extractUrl(text) ?? extractUrl(title) ?? ''
  if (!url && !hash.startsWith('#/save')) return null
  return { url, title, text }
}

// held on this device until someone signed in can save it; never written to the database before that
const KEY = 'planner-capture'

export function keepPending(c: Incoming): void {
  try { localStorage.setItem(KEY, JSON.stringify(c)) } catch { /* storage blocked: it lasts this visit */ }
}

export function peekPending(): Incoming | null {
  try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') as Incoming | null } catch { return null }
}

export function forgetCapture(): void {
  try { localStorage.removeItem(KEY) } catch { /* nothing to forget */ }
}

// what a saved link is called in a list: a title someone typed, else their note, else the site.
// the site's own name ("instagram", "example.com") is only a stand-in, so a note replaces it
export function linkName(l: Pick<Link, 'url' | 'title' | 'note'>): { title: string; sub: string } {
  const site = hostOf(l.url)
  const title = l.title.trim()
  const note = l.note.trim()
  const standIn = !title || title.toLowerCase() === platformOf(l.url) || title.toLowerCase() === site.toLowerCase()
  if (note && standIn) return { title: note, sub: site }
  // the site isn't said twice when it is already the name
  return { title: title || site, sub: [title ? site : '', note].filter(Boolean).join(' · ') }
}
