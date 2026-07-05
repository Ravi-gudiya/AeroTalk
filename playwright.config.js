import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'line',
  use: {
    actionTimeout: 0,
    trace: 'on-first-retry',
    viewport: { width: 375, height: 812 }, // mobile viewport simulation
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'chromium'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Pixel 5'] }
    }
  ],
  webServer: [
    {
      command: 'npm run start',
      port: 5000,
      reuseExistingServer: true,
      timeout: 120000
    },
    {
      command: 'npm run dev',
      port: 3000,
      reuseExistingServer: true,
      timeout: 120000
    }
  ]
});
