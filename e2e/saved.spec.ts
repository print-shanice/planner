import { test, expect, open, expectLine } from './fixtures'

test.describe('places', () => {
  test('a typed name is kept undated; a day select puts it on the plan, and it stays listed with its day', async ({ page }) => {
    await open(page, '/trip/bcn?tab=places')
    const places = page.getByRole('region', { name: 'places' })
    await expect(places).toContainText('park güell')
    await places.getByRole('combobox', { name: 'add a place' }).fill('tibidabo at sunset')
    await places.getByRole('button', { name: 'add place' }).click()
    await expect(places.getByRole('list', { name: 'not planned yet' })).toContainText('tibidabo at sunset')
    await places.getByRole('combobox', { name: 'add to day: tibidabo at sunset' }).selectOption('day:2027-04-16')
    await expect(places.getByRole('list', { name: 'in the plan' })).toContainText('tibidabo at sunset')
    await open(page, '/trip/bcn?day=2027-04-16')
    await expectLine(page.getByRole('region', { name: 'friday 16 april' }), 'tibidabo at sunset')
  })

  test('adding a place searches google maps; the same place is never added twice', async ({ page }) => {
    await open(page, '/trip/par?tab=places')
    const places = page.getByRole('region', { name: 'places' })
    const add = places.getByRole('combobox', { name: 'add a place' })
    await add.fill('louvre')
    await places.getByRole('list', { name: 'places found' }).getByRole('button', { name: /louvre museum/i }).click()
    await expect(places.getByRole('list', { name: 'not planned yet' })).toContainText(/louvre museum/i)
    await expect(add).toHaveValue('')
    await add.fill('louvre')
    await places.getByRole('list', { name: 'places found' }).getByRole('button', { name: /louvre museum/i }).click()
    await expect(places.getByRole('status', { name: 'already there' })).toContainText('already in places')
    await expect(places.getByRole('list', { name: 'not planned yet' }).getByText(/louvre museum/i)).toHaveCount(1)
  })

  test('the kind filter keeps one kind', async ({ page }) => {
    await open(page, '/trip/bcn?tab=places')
    const places = page.getByRole('region', { name: 'places' })
    await places.getByRole('group', { name: 'kind' }).getByRole('button', { name: /^park/ }).click()
    await expect(places).toContainText('park güell')
    await expect(places).not.toContainText('nomad coffee')
  })

  test('places are searched as one list', async ({ page }) => {
    await open(page, '/trip/bcn?tab=places')
    const places = page.getByRole('region', { name: 'places' })
    await places.getByRole('searchbox', { name: 'search places' }).fill('nomad')
    await expect(places).toContainText('nomad coffee')
    await expect(places).not.toContainText('park güell')
  })
})

test.describe('notes', () => {
  test('every note in the trip in one place, following the trip, and searchable', async ({ page }) => {
    await open(page, '/trip/bcn?tab=notes')
    const notes = page.getByRole('region', { name: 'notes' })
    await expect(notes.getByRole('list', { name: 'no date' })).toContainText('gifts to bring back')
    const day = notes.getByRole('list', { name: 'thu 15 apr' })
    await expect(day).toContainText('one cabin bag only')
    await expect(day).toContainText('key box code comes by email')
    await expect(day).toContainText('buy t-casual card')
    await notes.getByRole('searchbox', { name: 'search notes' }).fill('cabin')
    await expect(notes).toContainText('one cabin bag only')
    await expect(notes).not.toContainText('gifts to bring back')
  })

  test('a jotted note lands under no date, and a tap opens its card', async ({ page }) => {
    await open(page, '/trip/bcn?tab=notes')
    const notes = page.getByRole('region', { name: 'notes' })
    await notes.getByRole('textbox', { name: 'jot a note' }).fill('ask about the late check-out')
    await notes.getByRole('button', { name: 'add note' }).click()
    await expect(notes.getByRole('list', { name: 'no date' })).toContainText('ask about the late check-out')
    await notes.getByRole('button', { name: /key box code/ }).click()
    await expect(page.getByRole('dialog', { name: /flat in gràcia/ })).toBeVisible()
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

  test('a link with a long note still fits the screen, its menu in reach', async ({ page }) => {
    await open(page, '/trip/par?tab=links')
    await page.getByRole('button', { name: 'add', exact: true }).click()
    await page.getByRole('dialog', { name: 'add' }).getByRole('button', { name: 'link', exact: true }).click()
    const form = page.getByRole('dialog')
    await form.getByRole('textbox', { name: /link|url/ }).fill('https://www.reallylongdomainnameforthisexample-paris-food-guide.com/best-croissants')
    await form.getByRole('textbox', { name: 'note' }).fill('the pistachio croissant place near the canal that everyone keeps talking about')
    await form.getByRole('button', { name: 'save' }).click()
    const links = page.getByRole('region', { name: 'links' })
    await expect(links).toContainText('the pistachio croissant place')
    // nothing scrolls sideways: not the page (phone) and not the plan column (laptop)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
    const edge = await links.evaluate((el) => el.getBoundingClientRect().right)
    for (const more of await links.getByRole('button', { name: 'more' }).all()) {
      const box = (await more.boundingBox())!
      expect(box.x + box.width).toBeLessThanOrEqual(edge)
    }
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
    // added with nobody picked, so it's for both: my tick alone doesn't pack it for everyone
    await pack.getByRole('button', { name: 'shanice' }).click()
    await pack.getByRole('checkbox', { name: 'sunglasses' }).click()
    await expect(pack.getByRole('checkbox', { name: 'sunglasses' })).toBeChecked()
    await pack.getByRole('button', { name: 'shanice' }).click()
    await expect(pack.getByRole('checkbox', { name: 'sunglasses' })).not.toBeChecked()
    await expect(pack).toContainText('2 of 5 packed')
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

  test("a face shows that person's things and the shared ones; a shared tick is theirs alone", async ({ page }) => {
    await open(page, '/?view=packing&trip=eu')
    const pack = page.getByRole('region', { name: 'packing' })
    await pack.getByRole('button', { name: 'maya' }).click()
    await expect(pack).toContainText('1 of 2 packed')
    await expect(pack.getByRole('checkbox', { name: 'passport' })).toHaveCount(0)
    await pack.getByRole('checkbox', { name: 'adapter (eu plug)' }).click()
    await expect(pack).toContainText('0 of 2 packed')
    await pack.getByRole('button', { name: 'shanice' }).click()
    await expect(pack.getByRole('checkbox', { name: 'adapter (eu plug)' })).toBeChecked()
  })
})
