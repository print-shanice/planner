import { test as base, expect, type Locator, type Page } from '@playwright/test'

// every test runs on the same pretend day, so what is "upcoming" or "past" never drifts as real time passes
export const TODAY = '2026-11-10'

export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    await page.clock.setFixedTime(new Date(`${TODAY}T10:00:00`))
    await use(page)
  },
})

export { expect }

// the app is a hash router: #/ is home, #/trip/<id> a trip
export const open = (page: Page, hash = '/', search = '') => page.goto(`/${search}#${hash}`)

export const phone = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024

// a plan line's words: plain text on a phone, the value of a live input on a laptop, so both are read
export const lineText = (within: Locator) => within.evaluate((el) => `${el.textContent ?? ''} ${[...el.querySelectorAll('input')].map((i) => i.value).join(' ')}`)
export const expectLine = (within: Locator, text: string | RegExp, present = true) =>
  expect.poll(async () => { const t = await lineText(within); return typeof text === 'string' ? t.includes(text) : text.test(t) }, { timeout: 8_000 }).toBe(present)

// "sun 21 feb" (as a form says it) → "sunday 21 february" (as a day's heading says it)
const DAYS: Record<string, string> = { mon: 'monday', tue: 'tuesday', wed: 'wednesday', thu: 'thursday', fri: 'friday', sat: 'saturday', sun: 'sunday' }
const MONTHS: Record<string, string> = { jan: 'january', feb: 'february', mar: 'march', apr: 'april', may: 'may', jun: 'june', jul: 'july', aug: 'august', sept: 'september', sep: 'september', oct: 'october', nov: 'november', dec: 'december' }
export function longDay(short: string): string {
  const [d, n, m] = short.trim().split(' ')
  return `${DAYS[d]} ${n} ${MONTHS[m]}`
}
