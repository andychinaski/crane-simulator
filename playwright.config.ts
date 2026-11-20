import { defineConfig } from '@playwright/test'

const externalURL = process.env.E2E_BASE_URL
const baseURL = externalURL || 'http://localhost:5173'

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  timeout: 45_000,
  use: {
    baseURL,
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    launchOptions: { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] },
  },
  webServer: externalURL ? undefined : {
    command: 'npm run dev -- --strictPort',
    url: baseURL,
    reuseExistingServer: true,
  },
})
