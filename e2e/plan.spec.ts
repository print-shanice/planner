import { test, expect, open, phone, expectLine, longDay } from './fixtures'

test.describe('the plan', () => {
  test('directions belong to each destination, including the final accommodation', async ({ page }) => {
    await open(page, '/trip/bcn?day=2027-04-15')
    const day = page.getByRole('region', { name: 'thursday 15 april' })
    const flight = day.getByTestId('itin-line').filter({ hasText: 'eindhoven airport to el prat' })
    const airport = flight.locator('..').getByRole('link', { name: /directions to departure airport eindhoven airport/i })
    await expect(airport).toBeVisible()
    const airportUrl = new URL((await airport.getAttribute('href'))!)
    expect(airportUrl.searchParams.get('destination')).toBe('eindhoven airport')
    expect(airportUrl.searchParams.has('origin')).toBe(false)
    expect(airportUrl.searchParams.has('travelmode')).toBe(false)
    const stay = day.getByTestId('itin-line').filter({ hasText: 'check in · flat in gràcia' })
    const hotel = stay.locator('..').getByRole('link', { name: /directions to gràcia flat/i })
    await hotel.scrollIntoViewIfNeeded()
    await expect(hotel).toBeVisible()
    expect(new URL((await hotel.getAttribute('href'))!).searchParams.get('destination')).toBe('gràcia flat')
    const overflow = await page.locator('.trip-main').evaluate((el) => el.scrollWidth - el.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('a trip reads as one document: a day strip, days with their lines, walks between places', async ({ page }) => {
    await open(page, '/trip/par')
    await expect(page.getByRole('heading', { level: 1, name: 'paris' })).toBeVisible()
    await expect(page.getByText('19 – 23 feb · 4 nights')).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'days' }).getByRole('button')).toHaveCount(5)
    const sat = page.getByRole('region', { name: 'saturday 20 february' })
    await expect(sat).toContainText('day 2')
    await expect(sat.getByRole('button', { name: 'staying at · hotel marais' })).toBeVisible()
    await expectLine(sat, '10:00')
    await expectLine(sat, 'musée d’orsay')
    await expectLine(sat, 'du pain et des idées')
    await expect(sat.getByRole('link', { name: /min walk/ })).toHaveCount(3)
    await expect(sat.getByRole('link', { name: /min walk/ }).first()).toHaveAttribute('href', /google\.com\/maps\/dir/)
  })

  test('the day strip jumps to a day and the link remembers it', async ({ page }) => {
    await open(page, '/trip/par')
    await page.getByRole('navigation', { name: 'days' }).getByRole('button', { name: 'sunday 21 february' }).click()
    await expect(page.getByRole('region', { name: 'sunday 21 february' })).toBeInViewport()
  })

  test('typing on a day\'s line adds a place there, with its time', async ({ page }) => {
    await open(page, '/trip/par')
    const line = page.getByRole('group', { name: 'add to sun 21 feb' })
    await line.getByRole('textbox', { name: 'start time' }).fill('1pm')
    await line.getByRole('textbox', { name: 'add to sun 21 feb' }).fill('lunch at le comptoir')
    await line.getByRole('button', { name: 'add line' }).click()
    const sun = page.getByRole('region', { name: 'sunday 21 february' })
    await expectLine(sun, 'lunch at le comptoir')
    await expectLine(sun, '13:00')
    // the line is ready for the next one
    await expect(line.getByRole('textbox', { name: 'add to sun 21 feb' })).toHaveValue('')
  })

  test('a line held still for a moment can be carried onto another day, landing where the rule shows', async ({ page }) => {
    await open(page, '/trip/par')
    const sat = page.getByRole('region', { name: 'saturday 20 february' })
    const sun = page.getByRole('region', { name: 'sunday 21 february' })
    const line = sat.locator('[data-drop-line]').filter({ has: page.locator('[data-line]') }).last()
    // both days in view, once the page has stopped landing on its day (a busy machine can land late)
    await expect.poll(async () => {
      await line.evaluate((el) => el.scrollIntoView({ block: 'center' }))
      const a = await line.boundingBox()
      await page.waitForTimeout(150)
      const b = await line.boundingBox()
      return a?.y === b?.y
    }).toBe(true)
    const from = (await line.locator('.itin-time').boundingBox())!
    await page.mouse.move(from.x + 10, from.y + 10)
    await page.mouse.down()
    // moving at once is a scroll or a selection, not a carry
    await page.waitForTimeout(450)
    const to = (await sun.locator('[data-drop-line]').first().boundingBox())!
    await page.mouse.move(to.x + 40, to.y + 4, { steps: 12 })
    await expect(sun.locator('.drop-rule')).toHaveCount(1)
    await page.mouse.up()
    await expectLine(sun, 'du pain et des idées')
    await expectLine(sat, 'du pain et des idées', false)
  })

  test('a quick press on a line still opens or edits it, and carries nothing', async ({ page }) => {
    await open(page, '/trip/par')
    const sat = page.getByRole('region', { name: 'saturday 20 february' })
    const line = sat.locator('[data-line]').last()
    const box = (await line.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 200, { steps: 6 })
    await page.mouse.up()
    await expect(page.locator('.drop-rule')).toHaveCount(0)
    await expectLine(sat, 'du pain et des idées')
  })

  test('a name typed on a line is looked up on the map by itself, and gets its number when it plainly matches', async ({ page }) => {
    await open(page, '/trip/par')
    const line = page.getByRole('group', { name: 'add to sun 21 feb' })
    await line.getByRole('textbox', { name: 'add to sun 21 feb' }).fill('louvre museum')
    await line.getByRole('button', { name: 'add line' }).click()
    const sun = page.getByRole('region', { name: 'sunday 21 february' })
    await expect(sun.locator('[data-line] .seq')).toHaveCount(3)
    await expect(sun.getByRole('button', { name: 'find louvre museum on the map' })).toHaveCount(0)
  })

  test('a line typed without a place finds it on the map from its pin+, and gets its number', async ({ page }) => {
    await open(page, '/trip/par')
    const line = page.getByRole('group', { name: 'add to sun 21 feb' })
    await line.getByRole('textbox', { name: 'add to sun 21 feb' }).fill('flore')
    await line.getByRole('button', { name: 'add line' }).click()
    const sun = page.getByRole('region', { name: 'sunday 21 february' })
    await sun.getByRole('button', { name: 'find flore on the map' }).click()
    const panel = page.getByRole('region', { name: 'find flore on the map' })
    await expect(panel.getByRole('searchbox', { name: 'find flore' })).toHaveValue('flore')
    await panel.getByRole('button', { name: /Café de Flore/ }).click()
    await expect(panel).toBeHidden()
    if (phone(page)) await expect(page).not.toHaveURL(/tab=map/)
    await expect(page.getByRole('region', { name: 'sunday 21 february' }).getByRole('button', { name: 'find flore on the map' })).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'sunday 21 february' }).locator('[data-line] .seq')).toHaveCount(3)
  })

  test('an end before its start is refused with words', async ({ page }) => {
    await open(page, '/trip/par')
    const line = page.getByRole('group', { name: 'add to mon 22 feb' })
    await line.getByRole('textbox', { name: 'start time' }).fill('14:00')
    await line.getByRole('textbox', { name: 'end time' }).fill('13:00')
    await line.getByRole('textbox', { name: 'add to mon 22 feb' }).fill('something')
    await line.getByRole('button', { name: 'add line' }).click()
    await expect(page.getByText('end before start')).toBeVisible()
  })

  test('the + adds a place through the form, found with the search, and it lands on the day you are on', async ({ page }) => {
    await open(page, '/trip/par?day=2027-02-21')
    await expect(page.getByRole('region', { name: 'sunday 21 february' })).toBeInViewport()
    await page.getByRole('button', { name: 'add', exact: true }).click()
    const menu = page.getByRole('dialog', { name: 'add' })
    for (const kind of ['place', 'stay', 'journey', 'note', 'cost', 'link', 'side trip']) await expect(menu.getByRole('button', { name: kind, exact: true })).toBeVisible()
    await menu.getByRole('button', { name: 'place', exact: true }).click()
    const form = page.getByRole('dialog', { name: 'new place' })
    // the form is already set to the day being read; whichever it is, the place lands there
    const context = (await form.getByText(/^paris · /).textContent()) ?? ''
    const day = page.getByRole('region', { name: longDay(context.replace('paris · ', '')) })
    await form.getByRole('textbox', { name: 'name' }).fill('louvre')
    await form.getByRole('list', { name: 'places' }).getByRole('button', { name: /Louvre Museum/ }).click()
    await expect(form.getByRole('textbox', { name: 'name' })).toHaveValue('Louvre Museum')
    await form.getByRole('button', { name: 'save' }).click()
    await expect(form).toBeHidden()
    await expectLine(day, /louvre museum/i)
    await expect(day).toContainText(/museum · paris/i)
  })

  test('a line opens its card: its day and times, directions, ticket; moving it to another day is in edit', async ({ page }) => {
    await open(page, '/trip/par')
    const sat = page.getByRole('region', { name: 'saturday 20 february' })
    if (phone(page)) await sat.getByRole('button', { name: /^musée d’orsay/ }).click()
    else await sat.getByRole('button', { name: 'open musée d’orsay' }).click()
    const card = page.getByRole('dialog', { name: 'musée d’orsay' })
    await expect(card.getByRole('link', { name: 'directions' })).toHaveAttribute('href', /google\.com\/maps/)
    await expect(card.getByRole('button', { name: 'attach a ticket', exact: true })).toBeVisible()
    await expect(card).toContainText('sat 20 feb')
    await expect(card.getByLabel('from', { exact: true })).toHaveValue('10:00')
    await expect(card.getByRole('link', { name: /^next/ })).toHaveCount(0)
    await expect(card.getByLabel('day', { exact: true })).toHaveCount(0)
    await card.getByRole('button', { name: 'edit', exact: true }).click()
    const form = page.getByRole('dialog', { name: 'edit' })
    await form.getByRole('button', { name: /^choose .*sat 20 feb/ }).click()
    await page.getByRole('button', { name: 'sun 21 feb', exact: true }).click()
    await form.getByRole('button', { name: 'save' }).click()
    await page.getByRole('dialog', { name: 'musée d’orsay' }).getByRole('button', { name: 'close' }).click()
    await expectLine(page.getByRole('region', { name: 'sunday 21 february' }), 'musée d’orsay')
    await expectLine(sat, 'musée d’orsay', false)
  })

  test('"no date" in edit turns a place back into an idea', async ({ page }) => {
    await open(page, '/trip/par')
    const sun = page.getByRole('region', { name: 'sunday 21 february' })
    if (phone(page)) await sun.getByRole('button', { name: /^montmartre walk/ }).click()
    else await sun.getByRole('button', { name: 'open montmartre walk' }).click()
    const card = page.getByRole('dialog', { name: 'montmartre walk' })
    await card.getByRole('button', { name: 'edit', exact: true }).click()
    const form = page.getByRole('dialog', { name: 'edit' })
    await form.getByRole('button', { name: /^choose .*sun 21 feb/ }).click()
    await page.getByRole('button', { name: 'no date', exact: true }).click()
    await form.getByRole('button', { name: 'save' }).click()
    await page.getByRole('dialog', { name: 'montmartre walk' }).getByRole('button', { name: 'close' }).click()
    await expectLine(sun, 'montmartre walk', false)
    await open(page, '/trip/par?tab=ideas')
    await expect(page.getByRole('region', { name: 'ideas' })).toContainText('montmartre walk')
  })

  test('the card edits a booking: booked, with its reference', async ({ page }) => {
    await open(page, '/trip/par')
    const sat = page.getByRole('region', { name: 'saturday 20 february' })
    if (phone(page)) await sat.getByRole('button', { name: /^musée d’orsay/ }).click()
    else await sat.getByRole('button', { name: 'open musée d’orsay' }).click()
    const card = page.getByRole('dialog', { name: 'musée d’orsay' })
    await expect(card).toContainText('to book')
    await card.getByRole('button', { name: 'edit' }).click()
    const form = page.getByRole('dialog', { name: 'edit' })
    await form.getByRole('switch', { name: 'booked' }).click()
    await form.getByRole('textbox', { name: 'booking ref' }).fill('ORS-2211')
    await form.getByRole('button', { name: 'save' }).click()
    const after = page.getByRole('dialog', { name: 'musée d’orsay' })
    await expect(after.getByLabel('ref', { exact: true })).toHaveValue('ORS-2211')
    await expect(after.getByRole('group', { name: 'status' }).getByRole('button', { name: 'booked' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('deleting a place asks twice, then it is gone', async ({ page }) => {
    await open(page, '/trip/par')
    const sun = page.getByRole('region', { name: 'sunday 21 february' })
    if (phone(page)) await sun.getByRole('button', { name: /^sainte-chapelle/ }).click()
    else await sun.getByRole('button', { name: 'open sainte-chapelle' }).click()
    const card = page.getByRole('dialog', { name: 'sainte-chapelle' })
    await card.getByRole('button', { name: 'delete' }).click()
    await card.getByRole('button', { name: /sure|confirm|delete/ }).last().click()
    await expect(card).toBeHidden()
    await expectLine(sun, 'sainte-chapelle', false)
  })

  test('searching the plan finds lines and hides the other days', async ({ page }) => {
    await open(page, '/trip/par')
    await page.getByRole('button', { name: 'search the plan' }).click()
    await page.getByRole('searchbox', { name: 'search the plan' }).fill('chapelle')
    await expect(page.getByText('1 of 1')).toBeVisible()
    await expect(page.getByRole('region', { name: 'sunday 21 february' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'saturday 20 february' })).toBeHidden()
  })

  test('a long trip with side trips shows a calendar; its side trips open from it', async ({ page }) => {
    await open(page, '/trip/eu')
    await expect(page.getByRole('link', { name: /^next · in 101 days paris/ })).toBeVisible()
    await expect(page.getByRole('group', { name: 'january 2027' })).toBeVisible()
    await page.getByRole('button', { name: 'next month' }).click()
    await expect(page.getByRole('group', { name: 'february 2027' })).toBeVisible()
    await page.getByRole('button', { name: 'sat 20 feb' }).click()
    await expect(page).toHaveURL(/#\/trip\/par\?day=2027-02-20/)
  })

  test('laptops edit a line in place, and the edit is saved on enter', async ({ page }) => {
    test.skip(phone(page), 'phones open the card instead')
    await open(page, '/trip/par')
    const box = page.getByRole('textbox', { name: 'change du pain et des idées' })
    await box.fill('du pain et des idées · the pistachio one')
    await box.press('Enter')
    await expect(page.getByText('saved')).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'change du pain et des idées · the pistachio one' })).toBeVisible()
  })
})

test.describe('a line reads level', () => {
  test('status labels share one right edge across journeys, stays and places', async ({ page }) => {
    await open(page, '/trip/bcn?day=2027-04-15')
    const pills = page.locator('.itin-line .itin-end .pill')
    await expect(pills.first()).toBeVisible()
    expect(await pills.count()).toBeGreaterThanOrEqual(3)
    const rightEdges = await pills.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right))
    expect(Math.max(...rightEdges) - Math.min(...rightEdges)).toBeLessThanOrEqual(1.5)
  })

  // the middle of a line's first row: its time, its icon or number, its name, its status and its ›, all on one level
  test('time, icon, number, name and status share one middle; the typing line starts where names do', async ({ page }) => {
    await open(page, '/trip/jp')
    for (const name of ['monday 7 october', 'tuesday 8 october']) {
      const day = page.getByRole('region', { name })
      await day.scrollIntoViewIfNeeded()
      await expect(day.getByTestId('itin-line').first()).toBeVisible()
      const rows = await day.evaluate((el) => {
        const mid = (r: DOMRect) => r.top + r.height / 2
        // the first line of some text, by its glyphs rather than its box
        const firstLine = (n: Element | null) => {
          if (!n) return null
          if (n instanceof HTMLInputElement) return mid(n.getBoundingClientRect())
          const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT)
          let t = w.nextNode()
          while (t && !t.textContent?.trim()) t = w.nextNode()
          if (!t) return null
          const r = document.createRange()
          r.selectNodeContents(t)
          const box = r.getClientRects()[0]
          return box ? mid(box) : null
        }
        const box = (n: Element | null) => (n ? mid(n.getBoundingClientRect()) : null)
        return [...el.querySelectorAll('[data-testid="itin-line"]')].map((line) => ({
          name: line.textContent?.trim().slice(0, 30) || (line.querySelector('[data-doc-name]') as HTMLInputElement | null)?.value,
          time: firstLine(line.querySelector('.itin-time input, .itin-time > span:first-child')),
          mark: box(line.querySelector('.seq, .cat, .marker-finding, .marker-btn.find svg')),
          title: firstLine(line.querySelector('.itin-title, .doc-name')),
          pill: box(line.querySelector('.itin-end .pill')),
          open: box(line.querySelector('.itin-open svg')),
          nameX: (line.querySelector('.itin-title, .doc-name') as HTMLElement).getBoundingClientRect().left,
        }))
      })
      expect(rows.length).toBeGreaterThan(0)
      for (const r of rows) {
        for (const k of ['time', 'mark', 'pill', 'open'] as const) {
          if (r[k] == null || r.time == null && k === 'time') continue
          expect(Math.abs(r[k]! - r.title!), `${r.name}: ${k} sits ${(r[k]! - r.title!).toFixed(1)}px off the name`).toBeLessThanOrEqual(1.5)
        }
      }
      // the day's typing line: its name starts where the lines' names start
      const add = await day.locator('.add-line .line-name').evaluate((n) => n.getBoundingClientRect().left + parseFloat(getComputedStyle(n).paddingLeft))
      const names = await day.locator('.itin-title, .doc-name').first().evaluate((n) => n.getBoundingClientRect().left + parseFloat(getComputedStyle(n).paddingLeft))
      expect(Math.abs(add - names)).toBeLessThanOrEqual(1.5)
    }
  })
})


test('an itinerary number focuses its map pin and opens its place card', async ({ page }) => {
  await open(page, '/trip/par?day=2027-02-20')
  const day = page.getByRole('region', { name: 'saturday 20 february' })
  await day.getByRole('button', { name: 'show musée d’orsay on the map' }).click()
  const card = page.getByRole('region', { name: 'musée d’orsay', exact: true })
  await expect(card).toBeVisible()
  const pin = page.locator('.gpin-stop.lit').filter({ hasText: '01' })
  await expect(pin).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  if (!phone(page)) {
    await card.getByRole('button', { name: 'close', exact: true }).click()
    await day.getByRole('button', { name: 'show musée d’orsay on the map' }).click()
    await expect(card).toBeVisible()
  }
})
