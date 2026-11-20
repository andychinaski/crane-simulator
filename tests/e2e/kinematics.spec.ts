import { expect, test, type Page } from '@playwright/test'
import { canvas, lowerRopeToLimit, openSimulator, setSlider, status, waitForCrane } from './controls'

async function capture(page: Page, name: string) {
  if (process.env.CAPTURE_G2 === '1') await page.screenshot({ path: `evidence/G2/${name}.png` })
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openSimulator(page)
  await expect(canvas(page)).toBeVisible()
})

test('G2 animates each crane axis through the sliders and reports the floor limit', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await capture(page, 'initial')
  await setSlider(page, 'movementSpeed', 100)
  let previous = await canvas(page).screenshot()
  const changes = [
    ['platformYaw', 8], ['boomPitch', 48], ['boomLength', 7.4],
    ['ropeLength', 5.4], ['gripperYaw', -35], ['gripperOpen', 24],
  ] as const
  const bounds = (await canvas(page).boundingBox())!
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await page.mouse.wheel(0, 320)
  await expect.poll(async () => (await canvas(page).screenshot()).equals(previous)).toBe(false)
  previous = await canvas(page).screenshot()
  for (const [id, target] of changes) {
    await setSlider(page, id, target)
    await waitForCrane(page)
    const after = await canvas(page).screenshot()
    expect(after.equals(previous), `${id} should change the rendered pose`).toBe(false)
    previous = after
  }
  await capture(page, 'extended')

  await setSlider(page, 'boomPitch', 18)
  await setSlider(page, 'boomLength', 5.7)
  await setSlider(page, 'platformYaw', -18)
  await setSlider(page, 'gripperOpen', 100)
  await waitForCrane(page)
  const limit = await lowerRopeToLimit(page)
  await waitForCrane(page)
  await expect(status(page)).toContainText('Предел пола · трос')
  expect(limit).toBeLessThan(4.5)
  await capture(page, 'floor-limit')
  const rope = page.locator('#ropeLength')
  await setSlider(page, 'boomPitch', 10)
  await waitForCrane(page)
  const lowerLimit = Number(await rope.getAttribute('aria-valuemax'))
  expect(lowerLimit).toBeLessThan(limit)
  await expect.poll(async () => Number(await rope.inputValue())).toBeCloseTo(lowerLimit, 7)
  await setSlider(page, 'boomPitch', 42)
  await waitForCrane(page)
  expect(Number(await rope.getAttribute('aria-valuemax'))).toBeGreaterThan(lowerLimit)
  await expect(rope).toHaveAttribute('max', '8')
  await expect.poll(async () => Number(await rope.inputValue())).toBeCloseTo(lowerLimit, 7)
  await setSlider(page, 'ropeLength', 1.4)
  await waitForCrane(page)
  await expect(status(page)).toHaveText('Ручное управление')
  expect(errors).toEqual([])
})

test('G2 movement speed changes how long the same trip takes', async ({ page }) => {
  const trip = async (speed: number) => {
    await setSlider(page, 'movementSpeed', speed)
    const start = Date.now()
    await setSlider(page, 'boomPitch', 64)
    await expect(status(page)).toHaveAttribute('data-moving', 'true')
    await waitForCrane(page)
    return Date.now() - start
  }
  const fast = await trip(100)
  await setSlider(page, 'boomPitch', 42)
  await waitForCrane(page)
  const slow = await trip(20)
  expect(slow).toBeGreaterThan(fast * 1.5)
})

test('G2 camera sliders and mouse agree, and reset preserves the rendered crane pose', async ({ page }) => {
  await setSlider(page, 'platformYaw', 8)
  await waitForCrane(page)
  const start = await canvas(page).screenshot()
  let previous = start
  for (const [id, value] of [['sceneOrbit', 48], ['cameraPanX', 1.2], ['cameraPanY', 0.8], ['cameraZoom', 125]] as const) {
    await setSlider(page, id, value)
    await expect.poll(async () => (await canvas(page).screenshot()).equals(previous)).toBe(false)
    previous = await canvas(page).screenshot()
  }
  await setSlider(page, 'sceneOrbit', 180)
  await setSlider(page, 'sceneOrbit', -180)
  await setSlider(page, 'sceneOrbit', 48)

  const bounds = (await canvas(page).boundingBox())!
  const x = bounds.x + bounds.width / 2
  const y = bounds.y + bounds.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 75, y - 26, { steps: 5 })
  await page.mouse.up()
  await expect(page.locator('#sceneOrbit')).not.toHaveValue('48')
  await page.mouse.move(x, y)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(x + 55, y, { steps: 5 })
  await expect(page.locator('#cameraPanX')).not.toHaveValue('1.2')
  await expect(page.locator('#cameraPanY')).toHaveValue('0.8')
  const horizontalOffset = await page.locator('#cameraPanX').inputValue()
  await page.mouse.move(x + 55, y + 45, { steps: 5 })
  await page.mouse.up({ button: 'right' })
  await expect(page.locator('#cameraPanX')).toHaveValue(horizontalOffset)
  await expect(page.locator('#cameraPanY')).not.toHaveValue('0.8')
  previous = await canvas(page).screenshot()
  await page.mouse.wheel(0, -220)
  await expect.poll(async () => Number(await page.locator('#cameraZoom').inputValue())).toBeGreaterThan(125)
  await expect.poll(async () => (await canvas(page).screenshot()).equals(previous)).toBe(false)
  await page.getByRole('button', { name: 'Сбросить вид' }).click()
  for (const id of ['cameraPanX', 'cameraPanY', 'sceneOrbit']) await expect(page.locator(`#${id}`)).toHaveValue('0')
  await expect(page.locator('#cameraZoom')).toHaveValue('100')
  await expect(page.locator('#platformYaw')).toHaveValue('8')
  await expect.poll(async () => (await canvas(page).screenshot()).equals(start)).toBe(true)

  if (process.env.CAPTURE_G2 === '1') {
    await setSlider(page, 'sceneOrbit', -36)
    await setSlider(page, 'cameraPanX', 0.6)
    await setSlider(page, 'cameraPanY', 0.3)
    previous = await canvas(page).screenshot()
    await page.mouse.move(x, y)
    await page.mouse.wheel(0, 250)
    await expect.poll(async () => (await canvas(page).screenshot()).equals(previous)).toBe(false)
    await capture(page, 'camera')
  }
})
