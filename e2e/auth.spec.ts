import { test, expect, open } from './fixtures'

test.describe('signing in', () => {
  test('an email on the planner gets a code, and the code opens the planner', async ({ page }) => {
    await open(page, '/', '?signedout')
    await page.getByRole('textbox', { name: 'email' }).fill('shanice@example.com')
    await page.getByRole('button', { name: 'send link' }).click()
    await expect(page.getByText('check your inbox')).toBeVisible()
    await page.getByRole('textbox', { name: 'code' }).fill('000000')
    await page.getByRole('button', { name: 'sign in' }).click()
    await expect(page.getByText("that code didn't work")).toBeVisible()
    await page.getByRole('textbox', { name: 'code' }).fill('123456')
    await page.getByRole('button', { name: 'sign in' }).click()
    await expect(page.getByRole('heading', { level: 2, name: 'upcoming trips' })).toBeVisible()
  })

  test('an email that is not on the planner is told so', async ({ page }) => {
    await open(page, '/', '?signedout')
    await page.getByRole('textbox', { name: 'email' }).fill('stranger@elsewhere.org')
    await page.getByRole('button', { name: 'send link' }).click()
    await expect(page.getByText("this email isn't on the planner")).toBeVisible()
  })
})

test.describe('offline', () => {
  test('what was loaded stays readable, and nothing can be changed until the connection is back', async ({ page, context }) => {
    await open(page, '/trip/par')
    await expect(page.getByRole('heading', { name: 'saturday 20 february' })).toBeVisible()
    await context.setOffline(true)
    await page.evaluate(() => window.dispatchEvent(new Event('offline')))
    await expect(page.getByRole('status').filter({ hasText: 'offline' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'saturday 20 february' })).toBeVisible()
    const plus = page.getByRole('button', { name: 'add', exact: true })
    await expect(plus).toBeDisabled()
    // the typing lines under each day go away too
    await expect(page.getByRole('group', { name: /^add to/ })).toHaveCount(0)
    await context.setOffline(false)
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    await expect(plus).toBeEnabled()
    await expect(page.getByRole('group', { name: 'add to sat 20 feb' })).toBeVisible()
  })
})
