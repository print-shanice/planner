import { test, expect, open, phone, expectLine } from './fixtures'

test.describe('the map', () => {
  test('phones: the map tab shows the whole trip with its stays and numbered places, and a day on its own', async ({ page }) => {
    test.skip(!phone(page), 'laptops keep the map beside the plan')
    await open(page, '/trip/jp?tab=map')
    const map = page.getByRole('region', { name: 'map' })
    await expect(map.getByRole('button', { name: /^1 senso-ji/ })).toBeVisible()
    await expect(map.getByRole('button', { name: "tonight's bed" })).toHaveCount(2)
    await page.getByRole('button', { name: 'places list' }).click()
    const list = page.getByRole('region', { name: 'places' })
    await expect(list).toContainText('staying at shinjuku hostel')
    await expect(list).toContainText('staying at hop inn kyoto shijo omiya')
    await page.getByRole('combobox', { name: 'map scope' }).selectOption('2024-10-08')
    await expect(page).toHaveURL(/day=2024-10-08/)
    await expect(map.getByRole('button', { name: '1 fushimi inari' }).first()).toBeVisible()
    await expect(map.getByRole('button', { name: "tonight's bed" })).toHaveCount(1)
  })

  test('a pin opens the place card with what google says, and details open the full card', async ({ page }) => {
    await open(page, phone(page) ? '/trip/jp?tab=map' : '/trip/jp?day=2024-10-08')
    if (phone(page)) {
      await page.getByRole('button', { name: 'places list' }).click()
      await page.getByRole('region', { name: 'places' }).getByRole('button', { name: /staying at hop inn/ }).click()
    } else {
      // the laptop map shows the plan's day: that night's bed is the hop inn
      const map = page.getByRole('complementary', { name: 'map' })
      await expect(map.getByRole('button', { name: '1 fushimi inari' })).toBeVisible()
      await map.getByRole('button', { name: "tonight's bed" }).dispatchEvent('click')
    }
    const card = page.getByRole('region', { name: 'hop inn kyoto shijo omiya' })
    await expect(card).toContainText('★ 4.2 · 244 reviews · hotel')
    await card.getByRole('button', { name: 'details' }).click()
    const full = page.getByRole('dialog', { name: 'hop inn kyoto shijo omiya' })
    await expect(full).toContainText('★ 4.2 · 244 reviews · hotel')
    await expect(full.getByRole('link', { name: 'website' })).toHaveAttribute('href', 'https://hopinn.example/')
    await expect(full.getByRole('img', { name: 'hop inn kyoto shijo omiya' })).toBeVisible()
  })

  test('searching the map finds a place; it can be saved as an idea or put on a day', async ({ page }) => {
    await open(page, phone(page) ? '/trip/par?tab=map' : '/trip/par')
    await page.getByRole('searchbox', { name: 'search' }).fill('eiffel')
    await page.getByRole('button', { name: /Eiffel Tower/ }).click()
    const card = page.getByRole('region', { name: 'Eiffel Tower' })
    await expect(card).toContainText('★ 4.7')
    await card.getByRole('button', { name: /^day: / }).click()
    await page.getByRole('option', { name: /monday 22 february/ }).click()
    await expect(card.getByRole('textbox', { name: 'time' })).toBeFocused()
    await page.keyboard.type('15:30')
    await card.getByRole('button', { name: 'add to mon 22 feb at 15:30' }).click()
    await expect(card).toBeHidden()
    await open(page, '/trip/par?day=2027-02-22')
    await expectLine(page.getByRole('region', { name: 'monday 22 february' }), /eiffel tower/i)
  })

  test('laptops keep the map beside the plan and follow the day being read', async ({ page }) => {
    test.skip(phone(page), 'phones have a map tab')
    await open(page, '/trip/par')
    const map = page.getByRole('complementary', { name: 'map' })
    await expect(map).toBeVisible()
    await page.getByRole('navigation', { name: 'days' }).getByRole('button', { name: 'sunday 21 february' }).click()
    await expect(map.getByRole('button', { name: '1 sainte-chapelle' })).toBeVisible()
    await map.getByRole('button', { name: 'whole trip' }).click()
    await expect(map.getByRole('button', { name: '1 musée d’orsay' })).toBeVisible()
  })

  test('a trip with side trips opens on one pin per side trip, and a pin opens that trip', async ({ page }) => {
    await open(page, phone(page) ? '/trip/eu?tab=map' : '/trip/eu')
    const area = page.getByRole(phone(page) ? 'region' : 'complementary', { name: 'map' })
    await expect(area.getByRole('button', { name: 'paris, 19 – 23 feb' })).toBeVisible()
    await expect(area.getByRole('button', { name: 'lapland, 4 – 9 mar' })).toBeVisible()
    await area.getByRole('button', { name: 'paris, 19 – 23 feb' }).dispatchEvent('click')
    if (phone(page)) await expect(page).toHaveURL(/#\/trip\/par\?tab=map/)
    else await expect(page.getByRole('heading', { level: 1, name: 'paris' })).toBeVisible()
  })

  test('on a laptop, a pin carries its line from the map into another day of the plan', async ({ page }) => {
    test.skip(phone(page), 'a phone never shows the map and the plan together')
    await open(page, '/trip/par?day=2027-02-20')
    const map = page.getByRole('complementary', { name: 'map' })
    const pin = map.getByRole('button', { name: /^2 du pain et des idées/ })
    await expect(pin).toBeVisible()
    const sun = page.getByRole('region', { name: 'sunday 21 february' })
    const from = (await pin.boundingBox())!
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    const to = (await sun.locator('[data-drop-line]').first().boundingBox())!
    await page.mouse.move(to.x + 60, to.y + 4, { steps: 15 })
    await expect(page.locator('.drop-rule')).toHaveCount(1)
    await page.mouse.up()
    await expectLine(sun, 'du pain et des idées')
  })
})
