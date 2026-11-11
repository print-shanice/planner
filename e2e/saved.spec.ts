import { test, expect, open, expectLine } from './fixtures'

test.describe('ideas', () => {
  test('jotting an idea keeps it undated; a day select puts it on the plan', async ({ page }) => {
    await open(page, '/trip/bcn?tab=ideas')
    const ideas = page.getByRole('region', { name: 'ideas' })
    await expect(ideas).toContainText('park güell')
    await ideas.getByRole('textbox', { name: 'jot an idea' }).fill('tibidabo at sunset')
    await ideas.getByRole('button', { name: 'add idea' }).click()
    await expect(ideas).toContainText('tibidabo at sunset')
    await ideas.getByRole('combobox', { name: 'add to day: tibidabo at sunset' }).selectOption('2027-04-16')
    await expect(ideas).not.toContainText('tibidabo at sunset')
    await open(page, '/trip/bcn?day=2027-04-16')
    await expectLine(page.getByRole('region', { name: 'friday 16 april' }), 'tibidabo at sunset')
  })

  test('ideas are searched as one list', async ({ page }) => {
    await open(page, '/trip/bcn?tab=ideas')
    const ideas = page.getByRole('region', { name: 'ideas' })
    await ideas.getByRole('searchbox', { name: 'search ideas' }).fill('nomad')
    await expect(ideas).toContainText('nomad coffee')
    await expect(ideas).not.toContainText('park güell')
  })
})

test.describe('links', () => {
  test('the + saves a link under the trip, and it can be attached to a place', async ({ page }) => {
    await open(page, '/trip/par?tab=links')
    await page.getByRole('button', { name: 'add', exact: true }).click()
    await page.getByRole('dialog', { name: 'add' }).getByRole('button', { name: 'link', exact: true }).click()
    const form = page.getByRole('dialog')
    await form.getByRole('textbox', { name: /link|url/ }).fill('https://www.instagram.com/reel/abc123/')
    await form.getByRole('textbox', { name: 'note' }).fill('the pistachio croissant place')
    await form.getByRole('button', { name: 'save' }).click()
    const links = page.getByRole('region', { name: 'links' })
    await expect(links).toContainText('the pistachio croissant place')
  })

  test('a link shared to the planner lands in the save screen, then the trip', async ({ page }) => {
    await open(page, '/save?url=https%3A%2F%2Fyoutu.be%2Fshared1')
    const form = page.getByRole('main')
    await expect(form.getByRole('textbox', { name: 'link' })).toHaveValue('https://youtu.be/shared1')
    await form.getByLabel('trip').selectOption({ label: 'euro summer · lapland' })
    await form.getByRole('button', { name: 'save' }).click()
    await open(page, '/trip/lap?tab=links')
    await expect(page.getByRole('region', { name: 'links' })).toContainText('youtu.be')
  })
})

test.describe('packing', () => {
  test('add, tick, rename and remove; packed things sink', async ({ page }) => {
    await open(page, '/trip/eu?tab=packing')
    const pack = page.getByRole('region', { name: 'packing' })
    await expect(pack).toContainText('2 of 4 packed')
    await pack.getByRole('textbox', { name: 'add to pack' }).fill('sunglasses')
    await pack.getByRole('button', { name: 'add to pack' }).click()
    await expect(pack).toContainText('2 of 5 packed')
    await pack.getByRole('checkbox', { name: 'sunglasses' }).click()
    await expect(pack.getByRole('checkbox', { name: 'sunglasses' })).toBeChecked()
    await expect(pack).toContainText('3 of 5 packed')
    const items = pack.getByRole('list', { name: 'packing' }).getByRole('listitem')
    await expect(items.first()).toContainText('residence letter')
    await pack.getByRole('button', { name: 'edit rain jacket' }).click()
    await pack.getByRole('textbox', { name: 'packing item' }).fill('rain jacket (the yellow one)')
    await pack.getByRole('button', { name: 'save' }).click()
    await expect(pack).toContainText('rain jacket (the yellow one)')
    await pack.getByRole('button', { name: 'edit sunglasses' }).click()
    await pack.getByRole('button', { name: 'remove' }).click()
    await expect(pack).toContainText('2 of 4 packed')
  })
})
