import { expect, test as setup } from '@playwright/test';

// 与 wrangler.jsonc 本地开发配置的 ADMIN_EMAILS 保持一致，注册后自动获得管理员权限。
// 落在 .wrangler/e2e-state 的隔离 D1 里，与生产账号无关。
const ADMIN_EMAIL = 'meathill@gmail.com';
const ADMIN_PASSWORD = 'e2e-admin-test-pw';
const authFile = '.wrangler/e2e-state/admin-auth.json';

setup('管理员账号登录', async ({ page }) => {
  const signInResponse = await page.request.post('/api/auth/sign-in/email', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });

  if (!signInResponse.ok()) {
    // 首次运行本地隔离 D1 里还没有这个账号：better-auth 未开启邮箱验证/autoSignIn，
    // 注册请求会在同一次请求内建立 session，后续运行会走上面的登录分支。
    const signUpResponse = await page.request.post('/api/auth/sign-up/email', {
      data: {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        name: 'E2E Admin',
        acceptedTermsAt: new Date().toISOString(),
        acceptedTermsVersion: '2026-09-01',
        acceptedPrivacyVersion: '2026-09-01',
      },
    });
    expect(signUpResponse.ok()).toBe(true);
  }

  // 确保已同意最新条款，避免 dashboard 强制弹窗阻挡后续用例
  await page.request.post('/api/user/accept-terms');

  await page.context().storageState({ path: authFile });
});
