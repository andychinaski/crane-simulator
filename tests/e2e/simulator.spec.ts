import { expect, test } from '@playwright/test'
import { cameraControls, craneControls, formatValue } from '../../src/state/controls'
import { openSimulator } from './controls'

for (const [width, height] of [[1672, 941], [1440, 900], [1280, 720]]) {
  test(`renders WebGL and all panels at ${width}×${height}`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text())
    })
    await page.setViewportSize({ width, height })
    await openSimulator(page)

    const canvas = page.locator('canvas[data-ready=true]')
    await expect(canvas).toBeVisible()
    expect(await canvas.evaluate((element: HTMLCanvasElement) => {
      const gl = element.getContext('webgl2')
      return gl !== null && !gl.isContextLost() && gl.drawingBufferWidth === element.width
    })).toBe(true)
    const scene = page.getByRole('region', { name: 'Трёхмерная сцена' })
    const crane = page.getByRole('complementary', { name: 'Управление краном' })
    const camera = page.getByRole('region', { name: 'Камера', exact: true })
    await expect(crane.getByRole('slider')).toHaveCount(7)
    await expect(camera.getByRole('slider')).toHaveCount(4)
    for (const control of [...craneControls, ...cameraControls]) {
      const slider = page.getByRole('slider', { name: control.label, exact: true })
      await expect(slider).toHaveValue(String(control.initial))
      await expect(slider).toHaveAttribute('min', String(control.min))
      await expect(slider).toHaveAttribute('max', String(control.max))
      if (control.id === 'ropeLength') {
        const maximum = Number(await slider.getAttribute('aria-valuemax'))
        expect(maximum).toBeGreaterThan(control.initial)
        expect(maximum).toBeLessThan(control.max)
        await expect(slider).toHaveAttribute('step', 'any')
      } else {
        await expect(slider).toHaveAttribute('step', String(control.step))
      }
      await expect(slider).toBeEnabled()
      await expect(page.locator(`output[for="${control.id}"]`))
        .toHaveText(formatValue(control, control.initial))
    }

    const sceneBox = (await scene.boundingBox())!
    const craneBox = (await crane.boundingBox())!
    const cameraBox = (await camera.boundingBox())!
    expect(sceneBox.x + sceneBox.width).toBeLessThan(craneBox.x)
    expect(sceneBox.y + sceneBox.height).toBeLessThan(cameraBox.y)
    expect(cameraBox.y + cameraBox.height).toBeLessThan(height)
    await expect(scene.getByRole('button', { name: 'Выбрать режим' })).toHaveCount(0)
    await expect(scene.getByRole('button', { name: 'Сбросить сценарий' })).toBeInViewport()
    await expect(page.getByRole('button', { name: 'Сбросить вид' })).toBeInViewport()
    expect(errors).toEqual([])

    await page.getByRole('button', { name: 'Справка' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
  })
}

test('explains WebGL 2 initialization failure', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = new Proxy(getContext, {
      apply(target, canvas, args) {
        return args[0] === 'webgl2' ? null : Reflect.apply(target, canvas, args)
      },
    })
  })
  await openSimulator(page)
  await expect(page.getByRole('alert')).toContainText('поддерживает WebGL 2')
  await expect(page.getByRole('slider', { name: 'Наклон стрелы' })).toBeDisabled()
})

test('keeps both panels usable on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openSimulator(page)
  await expect(page.locator('canvas[data-ready=true]')).toBeVisible()
  const scene = (await page.getByRole('region', { name: 'Трёхмерная сцена' }).boundingBox())!
  const camera = (await page.getByRole('region', { name: 'Камера', exact: true }).boundingBox())!
  const crane = (await page.getByRole('complementary', { name: 'Управление краном' }).boundingBox())!
  expect(scene.y + scene.height).toBeLessThan(camera.y)
  expect(camera.y + camera.height).toBeLessThan(crane.y)
  await expect(page.getByRole('button', { name: 'Сбросить сценарий' })).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
})
