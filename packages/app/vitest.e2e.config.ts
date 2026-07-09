import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      remoteBindings: false,
      miniflare: {
        bindings: {
          ADMIN_SECRET: 'test-admin-secret',
          CF_AIG_TOKEN: 'test-token',
          RESEND_API_KEY: 'test-resend-key',
          ADMIN_EMAIL: 'admin@test.com',
          BASE_URL: 'http://localhost',
          CF_ACCOUNT_ID: 'test-account',
          CF_GATEWAY_ID: 'test-gateway',
          CF_TOKEN: 'test-cf-token',
          MIMO_API_KEY: 'test-mimo-key',
          ANTHROPIC_API_KEY: 'test-anthropic-key',
        },
      },
    }),
  ],
  test: {
    globals: true,
    include: ['e2e/**/*.test.ts'],
    setupFiles: ['./e2e/setup.ts'],
  },
});
