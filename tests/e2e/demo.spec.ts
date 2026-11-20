import { expect, test, type Page } from '@playwright/test'
import { canvas, chooseDemo, openSimulator, setSlider, status, waitForCrane } from './controls'

async function capture(page: Page, name: string) {
  if (process.env.CAPTURE_G4 === '1') await page.screenshot({ path: `evidence/G4/${name}.png` })
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openSimulator(page)
  await expect(canvas(page)).toBeVisible()
})

test('G4 demonstration restores the starting scenario and delivers the crate', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  const choose = page.getByRole('button', { name: 'Выбрать режим' })
  const stop = page.getByRole('button', { name: 'Стоп', exact: true })
  const cargo = page.locator('#cargo-status')
  await setSlider(page, 'platformYaw', 35)
  await waitForCrane(page)
  await choose.click()
  await chooseDemo(page, true)
  await expect(status(page)).toContainText('Сценарий сброшен')
  await expect(page.locator('#platformYaw')).toHaveValue('25')
  await expect(page.locator('#ropeLength')).toBeDisabled()
  await expect(stop).toBeEnabled()
  await setSlider(page, 'cameraZoom', 92)
  const approach = await page.evaluate(() => new Promise<{ samples: number[]; pauseMs: number }>(resolve => {
    const stage = document.querySelector<HTMLElement>('#stage-status')!
    const slider = document.querySelector<HTMLInputElement>('#ropeLength')!
    const samples: number[] = []
    let pauseAt: number | undefined
    const observe = (time: number) => {
      if (stage.dataset.demo === 'approach') {
        if (stage.dataset.demoPaused === 'true') pauseAt ??= time
        else if (slider.valueAsNumber > 3.2 && slider.valueAsNumber < 5.1) samples.push(slider.valueAsNumber)
      }
      if (stage.dataset.demo === 'close') resolve({ samples, pauseMs: time - (pauseAt ?? time) })
      else requestAnimationFrame(observe)
    }
    requestAnimationFrame(observe)
  }))
  expect(new Set(approach.samples).size).toBeGreaterThan(4)
  expect(approach.pauseMs).toBeGreaterThanOrEqual(450)
  await expect(status(page)).toHaveAttribute('data-demo', 'transfer', { timeout: 20_000 })
  await expect(cargo).toHaveText('Захвачен')
  await capture(page, 'demo-transfer')
  await expect(status(page)).toHaveText('Демонстрация завершена', { timeout: 20_000 })
  await expect(cargo).toHaveText('На площадке')
  await expect(page.locator('#ropeLength')).toHaveValue('3')
  await expect(page.locator('#gripperOpen')).toHaveValue('80')
  await expect(stop).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Повторить демонстрацию' })).toBeEnabled()
  await expect(page.locator('#cameraZoom')).toHaveValue('92')
  await page.getByRole('button', { name: 'Сбросить вид' }).click()
  await capture(page, 'demo-complete')
  expect(errors).toEqual([])
})

test('G4 Stop freezes the loaded crane and returns manual control', async ({ page }) => {
  await setSlider(page, 'movementSpeed', 35)
  const choose = page.getByRole('button', { name: 'Выбрать режим' })
  const stop = page.getByRole('button', { name: 'Стоп', exact: true })
  await choose.click()
  await chooseDemo(page)
  await expect(page.locator('#movementSpeed')).toHaveValue('35')
  await expect(status(page)).toHaveAttribute('data-demo', 'transfer', { timeout: 25_000 })
  await page.evaluate(() => new Promise<void>(resolve => {
    let frames = 0
    const next = () => { if (++frames === 5) resolve(); else requestAnimationFrame(next) }
    requestAnimationFrame(next)
  }))
  await stop.focus()
  await page.keyboard.press('Enter')
  await expect(status(page)).toHaveText('Демонстрация остановлена')
  await expect(page.locator('#cargo-status')).toHaveText('Захвачен')
  expect(Number(await page.locator('#platformYaw').inputValue())).toBeGreaterThan(25)
  expect(Number(await page.locator('#platformYaw').inputValue())).toBeLessThan(54)
  await expect(page.locator('#ropeLength')).toBeEnabled()
  await expect(stop).toHaveCount(0)
  await waitForCrane(page)
  const stopped = await canvas(page).screenshot()
  // The elapsed time is long enough for an uncancelled command to move the crane.
  await page.waitForTimeout(600)
  expect((await canvas(page).screenshot()).equals(stopped)).toBe(true)
  await capture(page, 'demo-stopped')
  await setSlider(page, 'ropeLength', 3)
  await waitForCrane(page)
  await expect(page.locator('#cargo-status')).toHaveText('Захвачен')
  expect((await canvas(page).screenshot()).equals(stopped)).toBe(false)
  await choose.click()
  await chooseDemo(page, true)
  await expect(page.locator('#cargo-status')).toHaveText('Свободен')
  await expect(page.locator('#movementSpeed')).toHaveValue('35')
})
