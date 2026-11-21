import { expect, type Page } from '@playwright/test'

export const canvas = (page: Page) => page.locator('canvas[data-ready=true]')
export const status = (page: Page) => page.locator('#stage-status')
export const modeDialog = (page: Page) => page.locator('.scenario-dialog')

export async function skipOnboarding(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Пропустить обучение', exact: true }).click()
}

export async function chooseManual(page: Page, guided = false) {
  const dialog = modeDialog(page)
  await dialog.getByRole('checkbox', { name: 'С подсказками' }).setChecked(guided)
  await dialog.getByRole('button', { name: 'Попробовать вручную' }).click()
}

export async function openSimulator(page: Page) {
  await skipOnboarding(page)
  await chooseManual(page)
}

export async function chooseDemo(page: Page) {
  await modeDialog(page).getByRole('button', { name: 'Демонстрация', exact: true }).click()
}

export const scenarioReset = (page: Page) => page.getByRole('button', { name: 'Сбросить сценарий' })
export const confirmReset = (page: Page) => modeDialog(page).getByRole('button', { name: 'Сбросить', exact: true })

export async function resetToModeSelection(page: Page) {
  await scenarioReset(page).click()
  await confirmReset(page).click()
  await expect(modeDialog(page)).toHaveAccessibleName('Выбрать режим')
}

export async function setSlider(page: Page, id: string, value: number) {
  const slider = page.locator(`#${id}`)
  await slider.fill(String(value))
  await expect(slider).toHaveValue(String(value))
}

export async function waitForCrane(page: Page) {
  // Give the renderer a turn to consume the input before inspecting idle state.
  await page.evaluate(() => new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  }))
  await expect(status(page)).toHaveAttribute('data-moving', 'false', { timeout: 15_000 })
}

export async function lowerRopeToLimit(page: Page) {
  const slider = page.locator('#ropeLength')
  const maximum = Number(await slider.getAttribute('aria-valuemax'))
  await slider.press('End')
  await expect.poll(async () => Number(await slider.inputValue())).toBeCloseTo(maximum, 7)
  return maximum
}
