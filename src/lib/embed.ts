export function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

// only web links are ever rendered as links (a stored "javascript:" url must not run)
export function safeUrl(url: string | null | undefined): string | null {
  const u = (url ?? '').trim()
  return /^https?:\/\//i.test(u) ? u : null
}
