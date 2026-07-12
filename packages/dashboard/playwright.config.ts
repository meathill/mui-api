import { defineConfig, devices } from '@playwright/test';

const e2eStatePath = '.wrangler/e2e-state';
const useSystemChrome = process.env.PLAYWRIGHT_USE_SYSTEM_CHROME === '1';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3035',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: useSystemChrome ? 'chrome' : undefined,
      },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    env: { MUI_API_STATE_PATH: e2eStatePath },
    port: 3035,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
