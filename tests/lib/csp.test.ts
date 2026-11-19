import { contentSecurityPolicy, cspPlugin } from '../../src/lib/csp'

const rules = (p: string) => Object.fromEntries(p.split(';').map((r) => r.trim()).filter(Boolean).map((r) => { const [k, ...v] = r.split(/\s+/); return [k, v] }))
const policy = rules(contentSecurityPolicy('https://abcd.supabase.co/'))

it('only the planner\'s own scripts and google maps run: nothing inline, no javascript: links, no plugins', () => {
  expect(policy['script-src']).not.toContain("'unsafe-inline'")
  expect(policy['script-src']).toContain("'self'")
  // google's vector map compiles webassembly; that, and only that, is allowed (never general eval)
  expect(policy['script-src']).toContain("'wasm-unsafe-eval'")
  expect(policy['script-src']).not.toContain("'unsafe-eval'")
  expect(policy['object-src']).toEqual(["'none'"])
  expect(policy['base-uri']).toEqual(["'self'"])
  expect(policy['form-action']).toEqual(["'self'"])
  expect(policy['default-src']).toEqual(["'self'"])
})

it('the app can still reach everything it talks to, and nowhere else', () => {
  const connect = policy['connect-src']
  for (const host of [
    'https://abcd.supabase.co', 'wss://abcd.supabase.co', 'https://photon.komoot.io', 'https://routing.openstreetmap.de',
    'https://api.frankfurter.dev', 'https://api.open-meteo.com', 'https://archive-api.open-meteo.com', 'https://en.wikipedia.org',
    'https://api.openverse.org', 'https://date.nager.at', 'https://*.googleapis.com',
  ]) expect(connect).toContain(host)
  expect(connect).not.toContain('https:')
  expect(connect).not.toContain('*')
})

it('without a project url (the test app) the policy still stands', () => {
  const p = rules(contentSecurityPolicy(undefined))
  expect(p['connect-src']).toContain("'self'")
  expect(p['connect-src'].some((h: string) => h.includes('supabase'))).toBe(false)
})

it('the built page gets the policy right after its charset, before any script', () => {
  const html = '<!doctype html>\n<html>\n  <head>\n    <meta charset="UTF-8" />\n    <script type="module" src="/planner/a.js"></script>\n  </head>\n</html>'
  const out = cspPlugin('https://abcd.supabase.co').transformIndexHtml(html)
  const at = (s: string) => out.indexOf(s)
  expect(at('http-equiv="Content-Security-Policy"')).toBeGreaterThan(at('<meta charset'))
  expect(at('http-equiv="Content-Security-Policy"')).toBeLessThan(at('<script'))
  expect(at('<meta charset')).toBeLessThan(1024)
})
