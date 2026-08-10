import { defineConfig, devices } from '@playwright/test';

const e2eStatePath = '.wrangler/e2e-state';
const useSystemChrome = process.env.PLAYWRIGHT_USE_SYSTEM_CHROME === '1';
// 本地网络下载不了 chromium headless shell 时，PLAYWRIGHT_CHROMIUM_CHANNEL=chromium
// 可改用完整版 chromium 的新 headless 模式（只需要主包，不需要 headless shell）
const chromiumChannel = useSystemChrome ? 'chrome' : process.env.PLAYWRIGHT_CHROMIUM_CHANNEL;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  // Next 16.3 dev 会并发写 prerender manifest；首次编译期并发导航可能损坏该 JSON。
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3035',
    trace: 'on-first-retry',
    // setup project 也要跑真实浏览器上下文，channel 必须放在顶层 use 才能全局生效
    channel: chromiumChannel,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /admin\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
      dependencies: ['setup'],
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
