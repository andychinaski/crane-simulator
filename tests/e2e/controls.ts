import { expect, type Page } from '@playwright/test'

export const canvas = (page: Page) => page.locator('canvas[data-ready=true]')
export const status = (page: Page) => page.locator('#stage-status')

export async function openSimulator(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Пропустить обучение', exact: true }).click()
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
