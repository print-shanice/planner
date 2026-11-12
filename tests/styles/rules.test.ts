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
// comments are left out, so a comment above a rule doesn't become part of its selector
const rules = files('src/styles', '.css').flatMap((f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').split('}').map((r) => r.split('{').slice(-2) as [string, string]).filter((r) => r.length === 2))

const TRIP = Array.from({ length: 12 }, (_, i) => `--g${i}`)

it('words in ink read on every trip colour', () => {
  for (const g of TRIP) expect(contrast(token(g), token('--ink')), g).toBeGreaterThanOrEqual(4.5)
})

it('trip colours never colour words: they only fill shapes', () => {
  const coloured = rules.filter(([, body]) => /(^|[\s;{])color:\s*var\(--(c|g\d+|pin)\b/.test(body)).map(([sel]) => sel.trim())
  expect(coloured).toEqual([])
})

it('faint controls still pass 3:1 on a card', () => {
  expect(contrast(token('--ink-3'), token('--card'))).toBeGreaterThanOrEqual(3)
})

it('no literal hex colours in components', () => {
  for (const f of files('src', '.tsx')) expect(read(f), f).not.toMatch(/#[0-9a-fA-F]{6}\b/)
})

it('the brand colour is only for the wordmark', () => {
  const users = [...files('src', '.css'), ...files('src', '.tsx')].filter((f) => read(f).includes('var(--brand)'))
  expect(users).toEqual([join('src', 'styles', 'base.css')])
})

it('green means booked or paid, nothing else', () => {
  const green = rules.filter(([, body]) => /var\(--ok\b/.test(body)).map(([sel]) => sel.trim())
  for (const sel of green) expect(sel).toMatch(/\.ok\b|paid/)
})

// every rule written for a selector, together (a selector can be styled in more than one place)
const ruleFor = (sel: string) => rules.filter(([s]) => s.trim() === sel).map(([, body]) => body).join(';')

it('icon buttons are 44px targets', () => {
  expect(ruleFor('.icon-btn')).toMatch(/width:\s*44px;\s*height:\s*44px/)
})

it('search boxes show focus, since their input hides its own outline: one ring, on the box\'s own edge', () => {
  expect(ruleFor('.search-box:focus-within')).toMatch(/outline:\s*1\.5px solid var\(--ink\);\s*outline-offset:\s*-1\.5px/)
})

const hsl = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min
  let h = 0
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: (h * 60 + 360) % 360, l }
}

it('the twelve trip colours sit at one softness, and any two can be told apart', () => {
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  for (const g of TRIP) expect(hsl(token(g)).l, g).toBeGreaterThan(0.6)
  for (const a of TRIP) for (const b of TRIP) {
    if (a >= b) continue
    const [x, y] = [rgb(token(a)), rgb(token(b))]
    expect(Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]), `${a} vs ${b}`).toBeGreaterThanOrEqual(20)
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

it('the trip bar sticks to the top with a solid background', () => {
  expect(ruleFor('.trip-bar')).toMatch(/position:\s*sticky/)
  expect(ruleFor('.trip-bar')).toMatch(/top:\s*0/)
  expect(ruleFor('.trip-bar')).toMatch(/background:\s*var\(--ground\)/)
})

it('the trip header never grows wider than the phone, however long the flags and dates', () => {
  expect(ruleFor('.trip-header')).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/)
})

it('scrolling never hides the trip\'s flags and dates', () => {
  const hiding = rules.filter(([sel, body]) => /\.trip-meta/.test(sel) && /display:\s*none/.test(body))
  expect(hiding).toEqual([])
})

it('a swiped inbox row is clipped at the edge, so the phone never pans the whole page', () => {
  expect(rules.some(([sel, body]) => sel.trim().endsWith('.home-inbox .doc-list') && /overflow-x:\s*clip/.test(body))).toBe(true)
  expect(rules.find(([sel]) => sel.trim().endsWith('\n.inbox-row') || sel.trim() === '.inbox-row')?.[1]).toMatch(/touch-action:\s*pan-y/)
})

it("a line's icon sits in the middle of its 44px button, level with the time and the name", () => {
  expect(ruleFor('.marker-btn .cat')).toMatch(/align-self:\s*center/)
  expect(ruleFor('.marker-btn')).toMatch(/width:\s*44px;\s*height:\s*44px/)
})
