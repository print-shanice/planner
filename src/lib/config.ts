export type ConfigProblem = 'url' | 'key' | 'secret'

function jwtRole(key: string): string | null {
  const part = key.split('.')[1]
  if (!part) return null
  try {
    return (JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as { role?: string }).role ?? null
  } catch {
    return null
  }
}

// catches the two easy mistakes when setting up: a key in the url field, and a secret key in a public site
export function configProblem(url: string | undefined, key: string | undefined): ConfigProblem | null {
  const k = (key ?? '').trim()
  if (k.startsWith('sb_secret_') || jwtRole(k) === 'service_role') return 'secret'
  try {
    const u = new URL((url ?? '').trim())
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return 'url'
  } catch {
    return 'url'
  }
  if (!k) return 'key'
  return null
}
