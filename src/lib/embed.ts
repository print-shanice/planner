export type Embed = { kind: 'instagram' | 'tiktok' | 'youtube' | 'link'; id?: string }

export function embedFor(url: string): Embed {
  let u: URL
  try { u = new URL(url) } catch { return { kind: 'link' } }
  const host = u.hostname.replace(/^www\.|^m\./, '')
  const path = u.pathname
  if (host === 'instagram.com') {
    const m = path.match(/^\/(?:reels?|p|tv)\/([\w-]+)/)
    if (m) return { kind: 'instagram', id: m[1] }
  }
  if (host === 'tiktok.com') {
    const m = path.match(/\/video\/(\d+)/)
    if (m) return { kind: 'tiktok', id: m[1] }
  }
  if (host === 'youtu.be') {
    const id = path.slice(1).split('/')[0]
    if (id) return { kind: 'youtube', id }
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const v = u.searchParams.get('v')
    if (v) return { kind: 'youtube', id: v }
    const m = path.match(/^\/(?:shorts|embed|live)\/([\w-]+)/)
    if (m) return { kind: 'youtube', id: m[1] }
  }
  return { kind: 'link' }
}

export function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}
