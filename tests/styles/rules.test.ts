import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), 'utf8')
function files(dir: string, ext: string): string[] {
  return readdirSync(join(root, dir)).flatMap((f) => {
    const p = join(dir, f)
    return statSync(join(root, p)).isDirectory() ? files(p, ext) : p.endsWith(ext) ? [p] : []
  })
}
const tokens = read('src/styles/tokens.css')
const token = (name: string) => tokens.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`))![1]
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
// every css rule as [selector, body]
const rules = files('src/styles', '.css').flatMap((f) => read(f).split('}').map((r) => r.split('{').slice(-2) as [string, string]).filter((r) => r.length === 2))

it('white numbers on every group colour pass 4.5:1', () => {
  for (const g of ['--g0', '--g1', '--g2', '--g3', '--g4', '--g5']) expect(contrast(token(g), token('--card')), g).toBeGreaterThanOrEqual(4.5)
})

it('faint controls still pass 3:1 on a card', () => {
  expect(contrast(token('--ink-3'), token('--card'))).toBeGreaterThanOrEqual(3)
})

it('no literal hex colours in components', () => {
  for (const f of files('src', '.tsx')) expect(read(f), f).not.toMatch(/#[0-9a-fA-F]{6}\b/)
})

it('the brand red is only for the wordmark', () => {
  const users = [...files('src', '.css'), ...files('src', '.tsx')].filter((f) => read(f).includes('var(--brand)'))
  expect(users).toEqual([join('src', 'styles', 'base.css')])
})

it('green means booked or paid, nothing else', () => {
  const green = rules.filter(([, body]) => /var\(--ok\b/.test(body)).map(([sel]) => sel.trim())
  for (const sel of green) expect(sel).toMatch(/\.ok\b|paid/)
})

const ruleFor = (sel: string) => rules.find(([s]) => s.trim() === sel)?.[1] ?? ''

it('icon buttons and the grip are 44px targets', () => {
  expect(ruleFor('.icon-btn')).toMatch(/width:\s*44px;\s*height:\s*44px/)
  expect(ruleFor('.grip')).toMatch(/width:\s*44px;\s*height:\s*44px/)
})

it('search boxes show focus, since their input hides its own outline', () => {
  expect(ruleFor('.search-box:focus-within')).toMatch(/outline:\s*2px solid var\(--ink\)/)
})

const hsl = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min
  let h = 0
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: (h * 60 + 360) % 360, l }
}

it('trip colours are six hues you can tell apart', () => {
  const gs = ['--g0', '--g1', '--g2', '--g3', '--g4', '--g5'].map((g) => [g, hsl(token(g))] as const)
  for (const [a, x] of gs) for (const [b, y] of gs) {
    if (a >= b) continue
    const hue = Math.min(Math.abs(x.h - y.h), 360 - Math.abs(x.h - y.h))
    expect(hue >= 30 || Math.abs(x.l - y.l) >= 0.2, `${a} vs ${b}`).toBe(true)
  }
})

it('stack-xs is a real style, so stacked lines never run together', () => {
  expect(ruleFor('.stack-xs')).toMatch(/flex-direction:\s*column/)
})

it('the pulse holds still for people who ask for less motion', () => {
  const css = read('src/styles/ui.css')
  expect(css).toMatch(/@keyframes pulse/)
  expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.pulse/)
})
