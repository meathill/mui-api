import { expect, test as setup } from '@playwright/test';

// 与 wrangler.jsonc 本地开发配置的 ADMIN_EMAILS 保持一致，注册后自动获得管理员权限。
// 落在 .wrangler/e2e-state 的隔离 D1 里，与生产账号无关。
const ADMIN_EMAIL = 'meathill@gmail.com';
const E2E_OTP = '123456';
const authFile = '.wrangler/e2e-state/admin-auth.json';

setup('管理员账号登录', async ({ page }) => {
  const sendOtpResponse = await page.request.post('/api/auth/email-otp/send-verification-otp', {
    data: { email: ADMIN_EMAIL, type: 'sign-in' },
  });
  expect(sendOtpResponse.ok()).toBe(true);

  const signInResponse = await page.request.post('/api/auth/sign-in/email-otp', {
    data: { email: ADMIN_EMAIL, otp: E2E_OTP, name: 'E2E Admin' },
  });
  expect(signInResponse.ok()).toBe(true);

  // 确保已同意最新条款，避免 dashboard 强制弹窗阻挡后续用例。
  await page.request.post('/api/user/accept-terms');

  await page.context().storageState({ path: authFile });
});
