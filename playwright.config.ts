import { defineConfig, devices } from '@playwright/test'

// the end-to-end tests drive the real app on made-up data (e2e/app), on a phone and on a laptop.
// they check what the planner does, not how it looks, so the look can change freely
export default defineConfig({
  testDir: 'e2e',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: 'http://localhost:5310',
    trace: 'retain-on-failure',
    locale: 'en-GB',
    timezoneId: 'Europe/Amsterdam',
  },
  projects: [
    { name: 'phone', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', isMobile: false, hasTouch: false } },
    { name: 'laptop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: 'npx vite build --config e2e/app/vite.config.ts --logLevel warn && npx vite preview --config e2e/app/vite.config.ts',
    url: 'http://localhost:5310',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
