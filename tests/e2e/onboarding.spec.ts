import { expect, test, type Locator, type Page } from '@playwright/test'
import { canvas, chooseDemo, chooseManual, modeDialog, setSlider, status, waitForCrane } from './controls'

const tour = (page: Page) => page.getByTestId('onboarding')
const button = (page: Page, name: string) => tour(page).getByRole('button', { name, exact: true })
const help = (page: Page) => page.getByRole('button', { name: 'Справка', exact: true })
const spotlight = (page: Page) => page.getByTestId('onboarding-spotlight')

async function restartFromHelp(page: Page) {
  await help(page).click()
  const dialog = page.getByRole('dialog', { name: 'Справка' })
  await expect(dialog).toContainText('Подведите открытый захват к ручке ящика.')
  await dialog.getByRole('button', { name: 'Пройти обучение ещё раз' }).click()
  await expect(dialog).toBeHidden()
  await expect(spotlight(page)).toHaveAttribute('data-zone', 'camera')
}

async function clickCenter(page: Page, locator: Locator) {
  const bounds = (await locator.boundingBox())!
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
}

test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })

test('G5 blocks simulator input and hands off to mode selection after skip or Escape', async ({ page }) => {
  await page.goto('/')
  await expect(canvas(page)).toBeVisible()
  await expect(tour(page).getByRole('button')).toHaveCount(2)
  const start = button(page, 'Пройти обучение')
  const skip = button(page, 'Пропустить обучение')
  await expect(tour(page)).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(skip).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(start).toBeFocused()
  await expect(start).toHaveCSS('outline-style', 'none')

  const pitch = page.locator('#boomPitch')
  const zoom = page.locator('#cameraZoom')
  const orbit = page.locator('#sceneOrbit')
  await clickCenter(page, pitch)
  await page.keyboard.press('ArrowRight')
  await expect(pitch).toHaveValue('42')
  await expect(status(page)).toHaveAttribute('data-demo', 'idle')
  await skip.click()
  await expect(tour(page)).toBeHidden()
  await expect(modeDialog(page)).toBeVisible()
  await clickCenter(page, pitch)
  await expect(pitch).toHaveValue('42')
  await chooseManual(page)
  await setSlider(page, 'boomPitch', 50)
  await page.reload()
  await expect(tour(page).getByRole('button')).toHaveCount(2)
  await button(page, 'Пропустить обучение').click()
  await chooseManual(page)

  await restartFromHelp(page)
  await clickCenter(page, zoom)
  await expect(zoom).toHaveValue('100')
  await button(page, 'Далее').click()
  await expect(spotlight(page)).toHaveAttribute('data-zone', 'scene')
  const scene = (await canvas(page).boundingBox())!
  await page.mouse.move(scene.x + 100, scene.y + 100)
  await page.mouse.wheel(0, -450)
  await page.mouse.down()
  await page.mouse.move(scene.x + 285, scene.y + 170, { steps: 5 })
  await page.mouse.up()
  await expect(zoom).toHaveValue('100')
  await expect(orbit).toHaveValue('0')
  await expect(page.locator('#cargo-status')).toHaveAttribute('data-state', 'GROUND')

  await page.keyboard.press('Escape')
  await expect(tour(page)).toBeHidden()
  await expect(help(page)).toBeFocused()
  await page.mouse.move(scene.x + 100, scene.y + 100)
  await page.mouse.wheel(0, -450)
  await expect(zoom).not.toHaveValue('100')
  await page.reload()
  await expect(button(page, 'Пройти обучение')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(modeDialog(page)).toBeVisible()
})

test('G5 keyboard navigation, finish, replay and skip preserve the stopped crane with cargo', async ({ page }) => {
  await page.goto('/')
  await button(page, 'Пройти обучение').click()
  await expect(tour(page).getByText('1 из 3')).toBeVisible()
  await expect(tour(page)).toBeFocused()
  await expect(button(page, 'Назад')).toHaveCount(0)
  await page.keyboard.press('Shift+Tab')
  await expect(button(page, 'Далее')).toBeFocused()
  await expect(button(page, 'Далее')).toHaveCSS('outline-style', 'none')
  await page.keyboard.press('Enter')
  await expect(tour(page).getByText('2 из 3')).toBeVisible()
  await button(page, 'Далее').click()
  await expect(tour(page).getByText('3 из 3')).toBeVisible()
  await button(page, 'Назад').click()
  await expect(spotlight(page)).toHaveAttribute('data-zone', 'scene')
  await button(page, 'Далее').click()
  await button(page, 'Завершить').click()
  await expect(tour(page)).toBeHidden()
  await expect(modeDialog(page)).toBeVisible()
  await page.reload()
  await expect(button(page, 'Пройти обучение')).toBeVisible()
  await button(page, 'Пропустить обучение').click()

  await chooseDemo(page)
  await setSlider(page, 'cameraZoom', 125)
  await expect(status(page)).toHaveAttribute('data-demo', 'transfer', { timeout: 20_000 })
  await page.getByRole('button', { name: 'Стоп', exact: true }).click()
  await waitForCrane(page)
  await expect(page.locator('#cargo-status')).toHaveAttribute('data-state', 'ATTACHED')
  const before = await canvas(page).screenshot()
  const controls = page.locator('.workspace input')
  const valuesBefore = await controls.evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value))

  await restartFromHelp(page)
  await button(page, 'Далее').click()
  await button(page, 'Далее').click()
  await clickCenter(page, page.locator('#platformYaw'))
  await button(page, 'Пропустить').click()
  await expect(tour(page)).toBeHidden()
  await expect(modeDialog(page)).toBeHidden()
  await expect(status(page)).toHaveAttribute('data-demo', 'stopped')
  await expect(page.locator('#cargo-status')).toHaveAttribute('data-state', 'ATTACHED')
  expect(await controls.evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value)))
    .toEqual(valuesBefore)
  expect((await canvas(page).screenshot()).equals(before)).toBe(true)
  await expect(page.locator('#platformYaw')).toBeEnabled()
})

test('G5 offers training in a reopened tab even with an old completion flag', async ({ page, context }) => {
  await page.goto('/')
  const key = 'crane-simulator:onboarding:v1'
  await page.evaluate(key => localStorage.setItem(key, 'seen'), key)
  await button(page, 'Пропустить обучение').click()
  const url = page.url()
  await page.close()

  const reopened = await context.newPage()
  await reopened.goto(url)
  await expect(button(reopened, 'Пройти обучение')).toBeVisible()
  await expect(button(reopened, 'Пропустить обучение')).toBeVisible()
})

const sizes = [{ width: 1672, height: 941 }, { width: 1440, height: 900 }, { width: 1280, height: 720 },
  { width: 390, height: 844 }]
const zones = [
  { name: 'camera', selector: '.camera-panel', title: 'Управление камерой' },
  { name: 'scene', selector: '.viewport', title: 'Рабочая область' },
  { name: 'crane', selector: '.crane-panel', title: 'Управление краном' },
]

test('G7 anchors the welcome to the scene and fits all G5 spotlights through live resize', async ({ page }) => {
  test.setTimeout(75_000)
  await page.setViewportSize(sizes[0])
  await page.goto('/')
  await expect(canvas(page)).toBeVisible()
  const originalCanvas = await canvas(page).elementHandle()
  const card = page.getByTestId('onboarding-card')

  async function verifyCard() {
    await expect(card).toBeInViewport({ ratio: 1 })
    await expect(card.getByRole('heading')).toBeInViewport({ ratio: 1 })
    for (const action of await card.getByRole('button').all()) {
      await expect(action).toBeInViewport({ ratio: 1 })
    }
    expect(await card.evaluate(element => element.scrollHeight - element.clientHeight)).toBe(0)
  }

  async function capture(name: string, width: number, height: number) {
    if (process.env.CAPTURE_G7 === '1') {
      await page.screenshot({ path: `evidence/G7/${name}-${width}x${height}.png` })
    }
  }

  for (const size of sizes) {
    await page.setViewportSize(size)
    await verifyCard()
    await expect.poll(async () => {
      const scene = (await page.locator('.viewport').boundingBox())!
      const dialog = (await card.boundingBox())!
      return Math.max(Math.abs(scene.x + scene.width / 2 - dialog.x - dialog.width / 2),
        Math.abs(scene.y + scene.height / 2 - dialog.y - dialog.height / 2))
    }).toBeLessThan(2)
    await capture('welcome', size.width, size.height)
  }
  await button(page, 'Пройти обучение').click()
  for (const [index, zone] of zones.entries()) {
    await expect(spotlight(page)).toHaveAttribute('data-zone', zone.name)
    await expect(card.getByRole('heading')).toHaveText(zone.title)
    await expect(card.getByText(`${index + 1} из 3`)).toBeInViewport({ ratio: 1 })
    for (const size of sizes) {
      await page.setViewportSize(size)
      const target = page.locator(zone.selector)
      await expect.poll(async () => {
        const bounds = (await target.boundingBox())!
        const x = Math.max(0, bounds.x)
        const y = Math.max(0, bounds.y)
        const width = Math.min(size.width, bounds.x + bounds.width) - x
        const height = Math.min(size.height, bounds.y + bounds.height) - y
        const highlight = await spotlight(page).boundingBox()
        return highlight ? Math.max(Math.abs(highlight.x - x), Math.abs(highlight.y - y),
          Math.abs(highlight.width - width), Math.abs(highlight.height - height)) : Infinity
      }).toBeLessThan(2)
      await verifyCard()
      if (index > 0) expect((await button(page, 'Назад').boundingBox())!.width).toBeGreaterThanOrEqual(110)
      if (size.width === 1672 && zone.name !== 'scene') expect((await card.boundingBox())!.width).toBe(500)
      if (index < zones.length - 1) {
        const next = (await button(page, 'Далее').boundingBox())!
        const skip = (await button(page, 'Пропустить').boundingBox())!
        expect(next.width).toBe(skip.width)
        expect(next.y).toBe(skip.y)
      }
      const bounds = (await card.boundingBox())!
      const area = (await target.boundingBox())!
      expect(bounds.x + bounds.width <= area.x || area.x + area.width <= bounds.x
        || bounds.y + bounds.height <= area.y || area.y + area.height <= bounds.y).toBe(true)
      await capture(zone.name, size.width, size.height)
    }
    if (index < zones.length - 1) await button(page, 'Далее').click()
  }
  await expect(page.locator('canvas')).toHaveCount(1)
  expect(await canvas(page).evaluate((current, original) => current === original, originalCanvas)).toBe(true)
})
