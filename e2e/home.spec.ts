import { test, expect, open, phone } from './fixtures'

test.describe('home', () => {
  test('opens on trips: the next trip leads, upcoming trips carry their side trips, past trips follow', async ({ page }) => {
    await open(page)
    await expect(page.getByRole('heading', { level: 1, name: 'planner' })).toBeVisible()
    const lead = page.getByRole('region', { name: 'euro summer' })
    await expect(lead).toContainText('next · in 79 days')
    await expect(lead.getByRole('link', { name: 'open the plan →' })).toHaveAttribute('href', '#/trip/eu?day=2027-01-28')
    await expect(page.getByRole('heading', { level: 2, name: 'upcoming trips' })).toBeVisible()
    await expect(page.getByRole('link', { name: /euro summer 28 jan – 13 jul/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /paris 19 – 23 feb/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /barcelona.*\+ montserrat/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /^someday rome/ })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'past trips' })).toBeVisible()
    await expect(page.getByRole('link', { name: /japan 2024 2 – 12 oct/ })).toBeVisible()
    // one add button on home
    await expect(page.getByRole('button', { name: 'add' })).toHaveCount(1)
  })

  test('the month calendar opens a day in its trip', async ({ page }) => {
    await open(page)
    await expect(page.getByRole('group', { name: 'january 2027' })).toBeVisible()
    await page.getByRole('button', { name: 'next month' }).click()
    await page.getByRole('button', { name: 'sat 20 feb' }).click()
    await expect(page).toHaveURL(/#\/trip\/par\?day=2027-02-20/)
    await expect(page.getByRole('heading', { level: 1, name: 'paris' })).toBeVisible()
  })

  test('a trip card opens the trip, and back comes home', async ({ page }) => {
    await open(page)
    await page.getByRole('link', { name: /paris 19 – 23 feb/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'paris' })).toBeVisible()
    await page.getByRole('link', { name: 'back to euro summer' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'euro summer' })).toBeVisible()
    await page.getByRole('link', { name: 'back to all trips' }).click()
    await expect(page.getByRole('heading', { level: 2, name: 'upcoming trips' })).toBeVisible()
  })

  test('the inbox lists links without a trip, and files them under a trip', async ({ page }) => {
    await open(page)
    await page.getByRole('link', { name: 'inbox · 2' }).click()
    const inbox = page.getByRole('region', { name: 'inbox' })
    await expect(inbox.getByRole('listitem')).toHaveCount(2)
    await inbox.getByRole('button', { name: 'move rooftop bar? to a trip' }).click()
    await page.getByRole('option', { name: /^paris/ }).click()
    await expect(inbox.getByRole('listitem')).toHaveCount(1)
    await expect(page.getByRole('link', { name: 'inbox · 1' })).toBeVisible()
    // it is now one of paris's links
    await open(page, '/trip/par?tab=links')
    await expect(page.getByRole('region', { name: 'links' }).getByRole('link', { name: /rooftop bar\?/ })).toBeVisible()
  })

  test('several inbox links can be ticked and moved at once', async ({ page }) => {
    await open(page, '/?view=inbox')
    await page.getByRole('button', { name: 'select all' }).click()
    await expect(page.getByText('2 selected')).toBeVisible()
    await page.getByRole('button', { name: 'move 2 links to a trip' }).click()
    await page.getByRole('option', { name: /^lapland/ }).click()
    await expect(page.getByText('inbox is empty')).toBeVisible()
  })

  test('travels counts only what has happened, and opening flights lists the routes taken', async ({ page }) => {
    await open(page, '/?view=travels')
    await expect(page.getByText('life well lived')).toBeVisible()
    await expect(page.getByRole('term').filter({ hasText: '5' })).toBeVisible()
    await expect(page.getByRole('definition').filter({ hasText: 'countries' })).toBeVisible()
    await expect(page.getByRole('term').filter({ hasText: '3' })).toBeVisible()
    await expect(page.getByRole('definition').filter({ hasText: 'trips' })).toBeVisible()
    const flights = page.getByRole('button', { name: 'flights · 3' })
    await flights.click()
    const list = page.getByRole('list', { name: 'flights' })
    await expect(list.getByRole('listitem')).toHaveCount(3)
    await expect(list).toContainText('singapore → tokyo')
    await flights.click()
    await expect(list).toBeHidden()
    await expect(page.getByRole('button', { name: /first stamped/ })).toHaveCount(5)
    await expect(page.getByRole('link', { name: /pastéis de belém/ })).toBeVisible()
  })

  test('the account sheet shows who is signed in and signs out', async ({ page }) => {
    await open(page)
    await page.getByRole('button', { name: 'account' }).click()
    const sheet = page.getByRole('dialog')
    await expect(sheet).toContainText('shanice@example.com')
    await sheet.getByRole('button', { name: 'sign out' }).click()
    await expect(page.getByRole('button', { name: 'send link' })).toBeVisible()
  })

  test('phones switch views under the wordmark, laptops beside it', async ({ page }) => {
    await open(page)
    const nav = page.getByRole('navigation', { name: 'home' })
    const wordmark = page.getByRole('heading', { level: 1, name: 'planner' })
    const a = await nav.boundingBox(), b = await wordmark.boundingBox()
    if (phone(page)) expect(a!.y).toBeGreaterThan(b!.y + b!.height - 1)
    else expect(Math.abs(a!.y - b!.y)).toBeLessThan(b!.height)
  })
})
