import { test, expect, open, phone } from './fixtures'

test.describe('trips', () => {
  test('home\'s + makes a new trip, which opens on its first day', async ({ page }) => {
    await open(page)
    await page.getByRole('button', { name: 'add' }).click()
    await page.getByRole('dialog', { name: 'add' }).getByRole('button', { name: 'trip', exact: true }).click()
    const form = page.getByRole('dialog', { name: /new trip/ })
    await form.getByRole('textbox', { name: 'name' }).fill('iceland in spring')
    await form.getByRole('textbox', { name: 'starts' }).fill('2027-05-03')
    await form.getByRole('textbox', { name: 'ends' }).fill('2027-05-09')
    await form.getByRole('button', { name: 'save' }).click()
    await expect(form).toBeHidden()
    await page.getByRole('link', { name: /^iceland in spring 3 – 9 may/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'iceland in spring' })).toBeVisible()
    await expect(page.getByText('3 – 9 may · 6 nights')).toBeVisible()
  })

  test('a trip\'s + adds a side trip inside it, dated, and it shows on the parent', async ({ page }) => {
    await open(page, '/trip/eu')
    await page.getByRole('button', { name: 'add', exact: true }).click()
    await page.getByRole('dialog', { name: 'add' }).getByRole('button', { name: 'side trip', exact: true }).click()
    const form = page.getByRole('dialog', { name: /side trip/ })
    await form.getByRole('textbox', { name: 'name' }).fill('amsterdam weekend')
    await form.getByRole('textbox', { name: 'starts' }).fill('2027-05-14')
    await form.getByRole('textbox', { name: 'ends' }).fill('2027-05-16')
    await form.getByRole('button', { name: 'save' }).click()
    await expect(form).toBeHidden()
    await open(page)
    await page.getByRole('link', { name: /^amsterdam weekend 14 – 16 may/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'amsterdam weekend' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'back to euro summer' })).toBeVisible()
  })

  test('the avatars open the trip to edit: name, dates and colour', async ({ page }) => {
    await open(page, '/trip/lap')
    await page.getByRole('button', { name: 'edit trip' }).click()
    const form = page.getByRole('dialog')
    await form.getByRole('textbox', { name: 'name' }).fill('lapland & the lights')
    await form.getByRole('radio', { name: 'orchid' }).click()
    await form.getByRole('button', { name: 'save' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'lapland & the lights' })).toBeVisible()
  })

  test('a trip with side trips cannot be deleted; an empty one can', async ({ page }) => {
    await open(page, '/trip/eu')
    await page.getByRole('button', { name: 'edit trip' }).click()
    await expect(page.getByRole('dialog').getByRole('button', { name: 'delete trip' })).toBeDisabled()
    await page.getByRole('dialog').getByRole('button', { name: 'close' }).click()
    await open(page, '/trip/rome')
    await page.getByRole('button', { name: 'edit trip' }).click()
    const form = page.getByRole('dialog')
    await form.getByRole('button', { name: 'delete trip' }).click()
    await form.getByRole('button', { name: /sure|confirm|delete/ }).last().click()
    // a deleted side trip hands you back to its parent
    await expect(page.getByRole('heading', { level: 1, name: 'euro summer' })).toBeVisible()
    await open(page)
    await expect(page.getByRole('link', { name: /^someday rome/ })).toHaveCount(0)
  })

  test('side trips that clash with a stay are flagged in words', async ({ page }) => {
    await open(page, '/trip/par?day=2027-02-19')
    await page.getByRole('button', { name: 'add', exact: true }).click()
    await page.getByRole('dialog', { name: 'add' }).getByRole('button', { name: 'stay', exact: true }).click()
    const form = page.getByRole('dialog', { name: 'new stay' })
    await form.getByRole('textbox', { name: 'name' }).fill('a second hotel')
    await form.getByRole('textbox', { name: 'check-in', exact: true }).fill('2027-02-20')
    await form.getByRole('textbox', { name: 'check-out', exact: true }).fill('2027-02-22')
    await form.getByRole('button', { name: 'save' }).click()
    await expect(page.getByText('dates clash')).toBeVisible()
  })
})

test.describe('moving between things', () => {
  test('plans have no other-trips footer on either a trip or a side trip', async ({ page }) => {
    await open(page, '/trip/eu')
    await expect(page.getByRole('heading', { level: 1, name: 'euro summer' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'other trips' })).toHaveCount(0)
    await open(page, '/trip/par')
    await expect(page.getByRole('heading', { level: 1, name: 'paris' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'other trips' })).toHaveCount(0)
  })

  test('a place\'s card keeps to itself: no trips or rest of its day, the plan beside it shows those', async ({ page }) => {
    await open(page, '/trip/par?day=2027-02-20')
    await page.getByText('musée d’orsay').first().click()
    const card = page.getByRole('dialog')
    await expect(card.getByLabel('from', { exact: true })).toBeVisible()
    await expect(card.getByRole('link', { name: 'euro summer' })).toHaveCount(0)
    await expect(card.getByRole('button', { name: 'du pain et des idées' })).toHaveCount(0)
  })
})
